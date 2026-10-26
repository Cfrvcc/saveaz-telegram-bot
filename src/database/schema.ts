export interface UserRecord {
  id: number;
  telegram_id: string;
  username: string | null;
  first_name: string | null;
  language: string;
  is_premium: number; // 0 or 1
  is_banned: number; // 0 or 1
  downloads_count: number;
  created_at: string;
  last_activity: string;
}

export interface DownloadRecord {
  id: string;
  telegram_id: string;
  url: string;
  platform: string;
  format: string; // 'mp4' | 'mp3' | 'hd' | 'zip'
  status: string; // 'completed' | 'failed' | 'processing'
  file_size: number;
  duration: number;
  title: string | null;
  created_at: string;
}

export interface RateLimitRecord {
  key: string;
  count: number;
  reset_at: number;
}
