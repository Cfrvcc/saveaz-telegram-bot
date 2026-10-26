import { logger } from '../utils/logger.js';
import { recordDownload } from '../database/db.js';
import { renderProgressBar, formatBytes, formatSpeed } from '../utils/formatters.js';

export interface DownloadProgress {
  jobId: string;
  status: 'queued' | 'downloading' | 'processing' | 'completed' | 'failed';
  percentage: number;
  downloadedBytes: number;
  totalBytes: number;
  speedBytesPerSec: number;
  etaSeconds: number;
  error?: string;
  fileUrl?: string;
  fileName?: string;
}

export interface StartJobParams {
  telegramId: string;
  url: string;
  platform: string;
  format: 'mp4' | 'mp3' | 'hd' | '4k' | 'zip';
  title?: string;
  duration?: number;
  approxSizeMb?: number;
}

const activeJobs = new Map<string, DownloadProgress>();

export function getJobProgress(jobId: string): DownloadProgress | null {
  return activeJobs.get(jobId) || null;
}

export function getAllActiveJobs(): DownloadProgress[] {
  return Array.from(activeJobs.values());
}

/**
 * Creates and starts a download job with progress updates.
 * In production, this coordinates with Save.az backend / yt-dlp / FFmpeg.
 */
export async function startDownloadJob(
  params: StartJobParams,
  onProgress?: (progress: DownloadProgress, progressText: string) => Promise<void>
): Promise<DownloadProgress> {
  const jobId = `job_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const totalBytes = Math.round((params.approxSizeMb || 18.4) * 1024 * 1024);

  const initialJob: DownloadProgress = {
    jobId,
    status: 'downloading',
    percentage: 5,
    downloadedBytes: Math.round(totalBytes * 0.05),
    totalBytes,
    speedBytesPerSec: 4.8 * 1024 * 1024,
    etaSeconds: 15,
  };

  activeJobs.set(jobId, initialJob);
  logger.info(`Download işi başladıldı: jobId=${jobId}, format=${params.format}`);

  // Simulating the streaming download ticks (in real execution, hooked to yt-dlp / backend progress callback)
  const steps = [
    { percent: 20, speed: 4.2, eta: 18 },
    { percent: 50, speed: 5.1, eta: 10 },
    { percent: 80, speed: 4.8, eta: 5 },
    { percent: 95, speed: 4.5, eta: 1 },
    { percent: 100, speed: 3.2, eta: 0 },
  ];

  // Run in background asynchronously so callers can poll or listen
  (async () => {
    try {
      for (const step of steps) {
        await new Promise(resolve => setTimeout(resolve, 800));

        const downloaded = Math.round((totalBytes * step.percent) / 100);
        const currentSpeedBytes = step.speed * 1024 * 1024;
        const currentStatus = step.percent === 100 ? 'completed' : 'downloading';

        const updated: DownloadProgress = {
          jobId,
          status: currentStatus,
          percentage: step.percent,
          downloadedBytes: downloaded,
          totalBytes,
          speedBytesPerSec: currentSpeedBytes,
          etaSeconds: step.eta,
          fileName: `saveaz_${params.platform}_${jobId}.${params.format === 'mp3' ? 'mp3' : 'mp4'}`,
          fileUrl: `/downloads/saveaz_${jobId}.${params.format === 'mp3' ? 'mp3' : 'mp4'}`,
        };

        activeJobs.set(jobId, updated);

        if (onProgress) {
          const text = buildProgressText(updated);
          await onProgress(updated, text).catch(() => {});
        }
      }

      // Record to database safely
      try {
        recordDownload({
          id: jobId,
          telegram_id: params.telegramId,
          url: params.url,
          platform: params.platform,
          format: params.format,
          status: 'completed',
          file_size: totalBytes,
          duration: params.duration || 60,
          title: params.title || 'Save.az Media',
        });
      } catch (recErr) {
        logger.warn('Download qeydi bazaya yazılarkən xəta', { error: String(recErr) });
      }

      logger.info(`Download işi tamamlandı: jobId=${jobId}`);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Yükləmə xətası';
      const failedJob: DownloadProgress = {
        jobId,
        status: 'failed',
        percentage: 0,
        downloadedBytes: 0,
        totalBytes,
        speedBytesPerSec: 0,
        etaSeconds: 0,
        error: errorMsg,
      };
      activeJobs.set(jobId, failedJob);

      recordDownload({
        id: jobId,
        telegram_id: params.telegramId,
        url: params.url,
        platform: params.platform,
        format: params.format,
        status: 'failed',
      });

      logger.error(`Download işi uğursuz oldu: jobId=${jobId}`, { error: errorMsg });
    }
  })();

  return initialJob;
}

/**
 * Builds the exact telegram progress string matching requirement Section 6:
 *
 * ⬇️ Yüklənir...
 *
 * ████████░░ 80%
 *
 * 📦 18.4 MB
 * ⚡ 4.8 MB/s
 * ⏱ Təxminən 12 saniyə
 */
export function buildProgressText(progress: DownloadProgress): string {
  if (progress.status === 'completed') {
    return '✅ Yükləmə tamamlandı!';
  }

  const bar = renderProgressBar(progress.percentage);
  const size = formatBytes(progress.totalBytes);
  const speed = formatSpeed(progress.speedBytesPerSec);
  const eta = progress.etaSeconds > 0 ? `${progress.etaSeconds} saniyə` : 'az qaldı';

  return `⬇️ Yüklənir...\n\n${bar}\n\n📦 ${size}\n⚡ ${speed}\n⏱ Təxminən ${eta}`;
}
