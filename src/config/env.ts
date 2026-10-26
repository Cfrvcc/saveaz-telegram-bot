import dotenv from 'dotenv';
dotenv.config();

export interface EnvConfig {
  NODE_ENV: string;
  PORT: number;
  TELEGRAM_BOT_TOKEN: string;
  SAVE_API_URL: string;
  ADMIN_TELEGRAM_IDS: string[];
  DATABASE_URL: string;
  GEMINI_API_KEY: string;
  BOT_MODE: 'polling' | 'webhook';
  WEBHOOK_DOMAIN: string;
  WEBHOOK_PATH: string;
  WEBHOOK_SECRET: string;
  ADMIN_USERNAME: string;
  ADMIN_PASSWORD: string;
  ADMIN_PASSWORD_HASH: string;
  MAX_DOWNLOAD_SIZE_MB: number;
  RATE_LIMIT_PER_MINUTE: number;
  MAX_PLAYLIST_ITEMS: number;
  DOWNLOAD_TIMEOUT_SECONDS: number;
}

const adminIdsRaw = process.env.ADMIN_TELEGRAM_IDS || '';
const parsedAdminIds = adminIdsRaw
  .split(',')
  .map(id => id.trim())
  .filter(id => id.length > 0);

export const config: EnvConfig = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT || '3000', 10),
  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN || '',
  SAVE_API_URL: process.env.SAVE_API_URL || 'https://save.az',
  ADMIN_TELEGRAM_IDS: parsedAdminIds.length > 0 ? parsedAdminIds : ['123456789'],
  DATABASE_URL: process.env.DATABASE_URL || './data/saveaz.db',
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
  BOT_MODE: (process.env.BOT_MODE === 'webhook' ? 'webhook' : 'polling') as 'polling' | 'webhook',
  WEBHOOK_DOMAIN: process.env.WEBHOOK_DOMAIN || '',
  WEBHOOK_PATH: process.env.WEBHOOK_PATH || '/telegram/webhook',
  WEBHOOK_SECRET: process.env.WEBHOOK_SECRET || 'saveaz-bot-secret-token',
  ADMIN_USERNAME: process.env.ADMIN_USERNAME || 'admin',
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || 'SaveAzAdmin2026!',
  ADMIN_PASSWORD_HASH: process.env.ADMIN_PASSWORD_HASH || '',
  MAX_DOWNLOAD_SIZE_MB: parseInt(process.env.MAX_DOWNLOAD_SIZE_MB || '50', 10),
  RATE_LIMIT_PER_MINUTE: parseInt(process.env.RATE_LIMIT_PER_MINUTE || '15', 10),
  MAX_PLAYLIST_ITEMS: parseInt(process.env.MAX_PLAYLIST_ITEMS || '20', 10),
  DOWNLOAD_TIMEOUT_SECONDS: parseInt(process.env.DOWNLOAD_TIMEOUT_SECONDS || '120', 10),
};

export function validateConfig(): { valid: boolean; warnings: string[] } {
  const warnings: string[] = [];

  if (!config.TELEGRAM_BOT_TOKEN) {
    warnings.push('TELEGRAM_BOT_TOKEN təyin edilməyib. Bot veb simulyator rejimində və API serveri kimi işləyəcək.');
  }

  if (config.BOT_MODE === 'webhook' && !config.WEBHOOK_DOMAIN) {
    warnings.push('BOT_MODE=webhook seçilib, lakin WEBHOOK_DOMAIN qeyd olunmayıb.');
  }

  return {
    valid: true,
    warnings,
  };
}
