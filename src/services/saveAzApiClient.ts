import axios, { AxiosError } from 'axios';
import { config } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { validateMediaUrl } from '../utils/urlValidator.js';
import { resolveMediaMetadata, MediaMetadata } from './mediaResolver.js';
import { startDownloadJob, getJobProgress, DownloadProgress } from './downloader.js';

/**
 * ============================================================================
 * SAVE.AZ BACKEND API SPECIFICATION (JSON SCHEMAS & TODOs)
 * ============================================================================
 * 
 * 1. POST /api/analyze
 * Request Body:
 *   {
 *     "url": "https://www.tiktok.com/@creator/video/123456789"
 *   }
 * 
 * Expected Response Structure (or standard wrapper):
 *   {
 *     "success": true, // optional boolean
 *     "id": "media_unique_id",
 *     "url": "https://...",
 *     "title": "Video Title",
 *     "author": "@creator",
 *     "duration": 45, // in seconds (or durationSeconds)
 *     "thumbnail": "https://...", // (or thumbnailUrl)
 *     "approxSizeMb": 18.4, // (or size_mb)
 *     "formats": [
 *       { "format": "mp4", "label": "🎬 MP4", "approxSizeMb": 18.4, "quality": "HD" },
 *       { "format": "mp3", "label": "🎵 MP3", "approxSizeMb": 3.5, "quality": "Audio 320kbps" }
 *     ]
 *   }
 * 
 * 2. POST /api/download
 * Request Body:
 *   {
 *     "telegramId": "123456789",
 *     "url": "https://...",
 *     "format": "mp4" | "mp3" | "hd",
 *     "quality": "HD"
 *   }
 * 
 * Expected Response:
 *   {
 *     "success": true,
 *     "jobId": "job_abc123" // (or "job_id" or "id")
 *   }
 * 
 * 3. GET /api/download/:jobId/progress
 * Expected Response:
 *   {
 *     "jobId": "job_abc123",
 *     "status": "queued" | "downloading" | "processing" | "completed" | "failed",
 *     "percentage": 80, // integer 0-100 (or "progress")
 *     "downloadedBytes": 15000000,
 *     "totalBytes": 19000000,
 *     "speedBytesPerSec": 4500000,
 *     "etaSeconds": 5,
 *     "fileUrl": "https://save.az/storage/download/abc123.mp4",
 *     "fileName": "video.mp4",
 *     "error": "..." // if failed
 *   }
 * ============================================================================
 */

export interface SaveAzAnalyzeResponse {
  success: boolean;
  data?: MediaMetadata;
  error?: string;
  errorCode?: string;
}

export interface SaveAzDownloadResponse {
  success: boolean;
  jobId: string;
  status: string;
  error?: string;
}

export class SaveAzApiClient {
  private baseUrl: string;

  constructor() {
    this.baseUrl = config.SAVE_API_URL.replace(/\/+$/, '');
  }

  public getBaseUrl(): string {
    return this.baseUrl;
  }

  private isSelfOrLocal(): boolean {
    return (
      !this.baseUrl ||
      this.baseUrl.includes('localhost') ||
      this.baseUrl.includes('127.0.0.1') ||
      this.baseUrl.includes('0.0.0.0')
    );
  }

  /**
   * Sends URL to Save.az: POST /api/analyze
   */
  async analyze(url: string): Promise<SaveAzAnalyzeResponse> {
    const validated = validateMediaUrl(url);
    if (!validated.isValid) {
      return {
        success: false,
        error: validated.error || '❌ Bu linki hazırda dəstəkləyə bilmirik.',
        errorCode: 'INVALID_URL',
      };
    }

    const endpoint = `${this.baseUrl}/api/analyze`;

    // If configured to external Save.az backend (e.g. SAVE_API_URL=https://save.az)
    if (!this.isSelfOrLocal()) {
      try {
        logger.info(`Save.az backend API-yə analiz sorğusu göndərilir: ${endpoint}`);
        const response = await axios.post(
          endpoint,
          { url },
          {
            timeout: 6000,
            headers: {
              'Content-Type': 'application/json',
              'User-Agent': 'SaveAzTelegramBot/1.0',
            },
          }
        );

        const resData = response.data;

        // Normalizing response payload from Save.az backend
        // Handles both wrapped { success, data: {...} } and direct media object { title, ... }
        const payload = resData.data || resData;

        // TODO: Save.az API Response Format - Update mappings here if your Save.az server keys differ:
        const normalizedMetadata: MediaMetadata = {
          id: payload.id || `media_${Date.now()}`,
          url: payload.url || url,
          platform: payload.platform || validated.platform || 'video',
          title: payload.title || payload.name || 'Sosial Media Video',
          author: payload.author || payload.uploader || payload.creator || '@istifadəçi',
          durationSeconds: payload.durationSeconds || payload.duration || (validated.isShorts ? 40 : 180),
          thumbnailUrl: payload.thumbnailUrl || payload.thumbnail || '',
          approxSizeMb: payload.approxSizeMb || payload.sizeMb || payload.size_mb || 18.4,
          availableFormats: Array.isArray(payload.availableFormats || payload.formats)
            ? (payload.availableFormats || payload.formats).map((f: any) => ({
                format: f.format || (f.type === 'audio' ? 'mp3' : 'mp4'),
                label: f.label || (f.format === 'mp3' ? '🎵 MP3' : '🎬 MP4'),
                approxSizeMb: f.approxSizeMb || f.size_mb || 18.4,
                quality: f.quality || (f.format === 'mp3' ? 'Audio 320kbps' : 'HD'),
              }))
            : [
                { format: 'mp4', label: '🎬 MP4', approxSizeMb: 18.4, quality: 'Standard HD' },
                { format: 'mp3', label: '🎵 MP3', approxSizeMb: 3.5, quality: '320 kbps Audio' },
                { format: 'hd', label: '📱 HD Video', approxSizeMb: 27.6, quality: '1080p Full HD' },
              ],
          isPlaylist: Boolean(payload.isPlaylist || validated.isPlaylist),
          playlistCount: payload.playlistCount || payload.count,
        };

        return {
          success: true,
          data: normalizedMetadata,
        };
      } catch (err: unknown) {
        const axErr = err as AxiosError<{ message?: string; error?: string }>;
        logger.warn(`Save.az backend analizi (${endpoint}) status: ${axErr.response?.status || 'network error'}. Lokal analiz sisteminə (fallback) keçirilir...`);

        if (axErr.response?.status === 400 || axErr.response?.status === 422) {
          return {
            success: false,
            error: axErr.response?.data?.error || axErr.response?.data?.message || '❌ Bu linki hazırda dəstəkləyə bilmirik.',
            errorCode: 'INVALID_URL',
          };
        }

        // Fallback to local resolver if remote endpoint is 404 or offline
        try {
          const fallbackMeta = await resolveMediaMetadata(validated);
          return {
            success: true,
            data: fallbackMeta,
          };
        } catch {
          return {
            success: false,
            error: '⚠️ Hazırda serverə qoşulmaq mümkün olmadı. Bir neçə dəqiqə sonra yenidən cəhd edin.',
            errorCode: 'PROVIDER_UNAVAILABLE',
          };
        }
      }
    }

    // Local / direct processing fallback when running standalone without external server
    try {
      const metadata = await resolveMediaMetadata(validated);
      return {
        success: true,
        data: metadata,
      };
    } catch {
      return {
        success: false,
        error: '⚠️ Video hazırda analiz edilə bilmədi. Bir az sonra yenidən cəhd edin.',
        errorCode: 'SERVER_ERROR',
      };
    }
  }

  /**
   * Starts a download job on Save.az backend: POST /api/download
   */
  async download(params: {
    telegramId: string;
    url: string;
    platform: string;
    format: 'mp4' | 'mp3' | 'hd' | '4k' | 'zip';
    title?: string;
    duration?: number;
    approxSizeMb?: number;
  }): Promise<SaveAzDownloadResponse> {
    const endpoint = `${this.baseUrl}/api/download`;

    if (!this.isSelfOrLocal()) {
      try {
        logger.info(`Save.az backend-ə download sorğusu göndərilir: ${endpoint}`);
        
        // TODO: Save.az Request Payload - adjust if your API expects different field names
        const requestPayload = {
          telegramId: params.telegramId,
          url: params.url,
          format: params.format,
          platform: params.platform,
          title: params.title,
          quality: params.format === 'hd' ? '1080p' : params.format === '4k' ? '2160p' : 'best',
        };

        const response = await axios.post(endpoint, requestPayload, {
          timeout: 6000,
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'SaveAzTelegramBot/1.0',
          },
        });

        const resData = response.data;
        // Accept jobId from varying schema styles: { jobId } or { job_id } or { id } or { data: { jobId } }
        const jobId =
          resData.jobId ||
          resData.job_id ||
          resData.id ||
          resData.data?.jobId ||
          resData.data?.job_id ||
          resData.data?.id;

        if (!jobId) {
          logger.error('Save.az API jobId qaytarmadı', { response: resData });
          return {
            success: false,
            jobId: '',
            status: 'failed',
            error: '⚠️ Serverdən iş ID-si alına bilmədi.',
          };
        }

        return {
          success: true,
          jobId: String(jobId),
          status: resData.status || resData.data?.status || 'queued',
        };
      } catch (err: unknown) {
        const axErr = err as AxiosError<{ message?: string; error?: string }>;
        logger.warn(
          `Save.az backend download (${endpoint}) status: ${axErr.response?.status || 'network error'}. Lokal emal sisteminə (fallback) keçirilir...`
        );

        // Graceful fallback to internal download job if remote endpoint returns 404 or is offline
        try {
          const fallbackJob = await startDownloadJob(params);
          return {
            success: true,
            jobId: fallbackJob.jobId,
            status: fallbackJob.status,
          };
        } catch {
          return {
            success: false,
            jobId: '',
            status: 'failed',
            error: '⚠️ Hazırda serverə qoşulmaq mümkün olmadı. Bir neçə dəqiqə sonra yenidən cəhd edin.',
          };
        }
      }
    }

    // Local / direct processing fallback
    try {
      const job = await startDownloadJob(params);
      return {
        success: true,
        jobId: job.jobId,
        status: job.status,
      };
    } catch {
      return {
        success: false,
        jobId: '',
        status: 'failed',
        error: '⚠️ Yükləmə başladılarkən xəta baş verdi.',
      };
    }
  }

  /**
   * Polls job progress on Save.az backend: GET /api/download/:jobId/progress
   */
  async getProgress(jobId: string): Promise<DownloadProgress | null> {
    // If job is already running locally (e.g. from fallback or local server), prioritize local progress
    const localJob = getJobProgress(jobId);
    if (localJob) {
      return localJob;
    }

    const endpoint = `${this.baseUrl}/api/download/${jobId}/progress`;

    if (!this.isSelfOrLocal()) {
      try {
        const response = await axios.get(endpoint, {
          timeout: 8000,
          headers: {
            'User-Agent': 'SaveAzTelegramBot/1.0',
          },
        });

        const resData = response.data;
        const payload = resData.data || resData;

        // TODO: Save.az API Progress Response mapping
        const percentage = Number(payload.percentage ?? payload.progress ?? 0);
        const status = payload.status || (percentage >= 100 ? 'completed' : 'downloading');

        return {
          jobId,
          status,
          percentage,
          downloadedBytes: Number(payload.downloadedBytes || payload.downloaded_bytes || 0),
          totalBytes: Number(payload.totalBytes || payload.total_bytes || 1),
          speedBytesPerSec: Number(payload.speedBytesPerSec || payload.speed || 0),
          etaSeconds: Number(payload.etaSeconds || payload.eta || 0),
          fileUrl: payload.fileUrl || payload.downloadUrl || payload.url,
          fileName: payload.fileName || payload.filename,
          error: payload.error,
        };
      } catch (err: unknown) {
        logger.warn(`Save.az progress alına bilmədi: ${jobId}`, { error: String(err) });
        return getJobProgress(jobId);
      }
    }

    return getJobProgress(jobId);
  }
}

export const saveAzApiClient = new SaveAzApiClient();
