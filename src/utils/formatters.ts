/**
 * Creates visual text progress bar like:
 * ████████░░ 80%
 */
export function renderProgressBar(percentage: number, totalBlocks = 10): string {
  const clamped = Math.max(0, Math.min(100, Math.round(percentage)));
  const filledBlocks = Math.round((clamped / 100) * totalBlocks);
  const emptyBlocks = totalBlocks - filledBlocks;
  const bar = '█'.repeat(filledBlocks) + '░'.repeat(emptyBlocks);
  return `${bar} ${clamped}%`;
}

/**
 * Format bytes to human readable format (MB, KB, GB)
 */
export function formatBytes(bytes: number, decimals = 1): string {
  if (!bytes || bytes <= 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

/**
 * Format seconds into MM:SS or HH:MM:SS
 */
export function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return '00:00';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  const pad = (n: number) => n.toString().padStart(2, '0');
  if (hrs > 0) {
    return `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
  }
  return `${pad(mins)}:${pad(secs)}`;
}

/**
 * Format speed in MB/s or KB/s
 */
export function formatSpeed(bytesPerSec: number): string {
  if (!bytesPerSec || bytesPerSec <= 0) return '0 MB/s';
  const mbPerSec = bytesPerSec / (1024 * 1024);
  if (mbPerSec >= 0.1) {
    return `${mbPerSec.toFixed(1)} MB/s`;
  }
  const kbPerSec = bytesPerSec / 1024;
  return `${kbPerSec.toFixed(1)} KB/s`;
}

/**
 * Sanitize filename to prevent path traversal and shell injection
 */
export function sanitizeFileName(name: string): string {
  if (!name) return 'media_saveaz';
  return name
    .replace(/[/\\?%*:|"<>]/g, '_')
    .replace(/\.\.+/g, '_')
    .trim()
    .slice(0, 100);
}
