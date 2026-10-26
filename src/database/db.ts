import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { config } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { UserRecord, DownloadRecord } from './schema.js';

let dbInstance: Database.Database | null = null;

export function getDatabase(): Database.Database {
  if (dbInstance) {
    return dbInstance;
  }

  // Ensure target directory exists for SQLite
  const dbPath = config.DATABASE_URL.startsWith('sqlite:')
    ? config.DATABASE_URL.replace('sqlite:', '')
    : config.DATABASE_URL;

  const resolvedPath = path.resolve(process.cwd(), dbPath);
  const dir = path.dirname(resolvedPath);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  logger.info(`Database açılır: ${resolvedPath}`);
  dbInstance = new Database(resolvedPath);

  // WAL mode for faster concurrent reads/writes
  dbInstance.pragma('journal_mode = WAL');
  dbInstance.pragma('foreign_keys = ON');

  initSchema(dbInstance);

  return dbInstance;
}

function initSchema(db: Database.Database) {
  // Ensure tables exist
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      telegram_id TEXT UNIQUE NOT NULL,
      username TEXT,
      first_name TEXT,
      language TEXT DEFAULT 'az',
      is_premium INTEGER DEFAULT 0,
      is_banned INTEGER DEFAULT 0,
      downloads_count INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      last_activity TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS downloads (
      id TEXT PRIMARY KEY,
      telegram_id TEXT NOT NULL,
      url TEXT NOT NULL,
      platform TEXT NOT NULL,
      format TEXT NOT NULL,
      status TEXT NOT NULL,
      file_size INTEGER DEFAULT 0,
      duration INTEGER DEFAULT 0,
      title TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS rate_limits (
      key TEXT PRIMARY KEY,
      count INTEGER NOT NULL DEFAULT 0,
      reset_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS system_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      level TEXT NOT NULL,
      message TEXT NOT NULL,
      meta TEXT,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_users_telegram_id ON users(telegram_id);
    CREATE INDEX IF NOT EXISTS idx_downloads_telegram_id ON downloads(telegram_id);
    CREATE INDEX IF NOT EXISTS idx_downloads_created_at ON downloads(created_at);
  `);
  logger.info('Database sxemi təsdiqləndi və hazırdır.');
}

// User operations
export function upsertUser(
  telegramId: string,
  username?: string | null,
  firstName?: string | null,
  language = 'az'
): UserRecord {
  const db = getDatabase();
  const now = new Date().toISOString();

  const existing = db.prepare('SELECT * FROM users WHERE telegram_id = ?').get(telegramId) as UserRecord | undefined;

  if (existing) {
    db.prepare(`
      UPDATE users 
      SET username = COALESCE(?, username),
          first_name = COALESCE(?, first_name),
          last_activity = ?
      WHERE telegram_id = ?
    `).run(username || null, firstName || null, now, telegramId);

    return {
      ...existing,
      username: username ?? existing.username,
      first_name: firstName ?? existing.first_name,
      last_activity: now,
    };
  }

  db.prepare(`
    INSERT INTO users (telegram_id, username, first_name, language, is_premium, is_banned, downloads_count, created_at, last_activity)
    VALUES (?, ?, ?, ?, 0, 0, 0, ?, ?)
  `).run(telegramId, username || null, firstName || null, language, now, now);

  return db.prepare('SELECT * FROM users WHERE telegram_id = ?').get(telegramId) as UserRecord;
}

export function getUser(telegramId: string): UserRecord | null {
  const db = getDatabase();
  return (db.prepare('SELECT * FROM users WHERE telegram_id = ?').get(telegramId) as UserRecord) || null;
}

export function getAllUsers(page = 1, limit = 50, search = ''): { users: UserRecord[]; total: number } {
  const db = getDatabase();
  const offset = (page - 1) * limit;

  let query = 'SELECT * FROM users';
  let countQuery = 'SELECT COUNT(*) as count FROM users';
  const params: unknown[] = [];

  if (search.trim()) {
    query += ' WHERE telegram_id LIKE ? OR username LIKE ? OR first_name LIKE ?';
    countQuery += ' WHERE telegram_id LIKE ? OR username LIKE ? OR first_name LIKE ?';
    const s = `%${search.trim()}%`;
    params.push(s, s, s);
  }

  query += ' ORDER BY id DESC LIMIT ? OFFSET ?';
  const users = db.prepare(query).all(...params, limit, offset) as UserRecord[];
  const countRow = db.prepare(countQuery).get(...params) as { count: number };

  return { users, total: countRow.count };
}

export function setUserBanStatus(telegramId: string, isBanned: boolean): boolean {
  const db = getDatabase();
  const result = db.prepare('UPDATE users SET is_banned = ? WHERE telegram_id = ?').run(isBanned ? 1 : 0, telegramId);
  return result.changes > 0;
}

export function setUserPremiumStatus(telegramId: string, isPremium: boolean): boolean {
  const db = getDatabase();
  const result = db.prepare('UPDATE users SET is_premium = ? WHERE telegram_id = ?').run(isPremium ? 1 : 0, telegramId);
  return result.changes > 0;
}

// Download operations
export function recordDownload(download: {
  id: string;
  telegram_id: string;
  url: string;
  platform: string;
  format: string;
  status: string;
  file_size?: number;
  duration?: number;
  title?: string;
}): void {
  const db = getDatabase();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO downloads (id, telegram_id, url, platform, format, status, file_size, duration, title, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    download.id,
    download.telegram_id,
    download.url,
    download.platform,
    download.format,
    download.status,
    download.file_size || 0,
    download.duration || 0,
    download.title || 'Başlıqsız Media',
    now
  );

  if (download.status === 'completed') {
    db.prepare('UPDATE users SET downloads_count = downloads_count + 1 WHERE telegram_id = ?').run(download.telegram_id);
  }
}

export function getUserDownloads(telegramId: string, limit = 10): DownloadRecord[] {
  const db = getDatabase();
  return db.prepare('SELECT * FROM downloads WHERE telegram_id = ? ORDER BY created_at DESC LIMIT ?').all(telegramId, limit) as DownloadRecord[];
}

export function getUserStats(telegramId: string): {
  total: number;
  mp3: number;
  video: number;
  lastActive: string;
} {
  const db = getDatabase();
  const user = getUser(telegramId);

  const totalRow = db.prepare("SELECT COUNT(*) as count FROM downloads WHERE telegram_id = ? AND status = 'completed'").get(telegramId) as { count: number };
  const mp3Row = db.prepare("SELECT COUNT(*) as count FROM downloads WHERE telegram_id = ? AND status = 'completed' AND format = 'mp3'").get(telegramId) as { count: number };
  const videoRow = db.prepare("SELECT COUNT(*) as count FROM downloads WHERE telegram_id = ? AND status = 'completed' AND (format = 'mp4' OR format = 'hd')").get(telegramId) as { count: number };

  return {
    total: totalRow?.count || 0,
    mp3: mp3Row?.count || 0,
    video: videoRow?.count || 0,
    lastActive: user?.last_activity ? new Date(user.last_activity).toLocaleDateString('az-AZ') : 'bu gün',
  };
}

export function getGlobalStats(): {
  totalUsers: number;
  activeUsers: number;
  totalDownloads: number;
  mp3Downloads: number;
  videoDownloads: number;
  platformStats: Record<string, number>;
  recentDownloads: DownloadRecord[];
  failedCount: number;
} {
  const db = getDatabase();

  const totalUsers = (db.prepare('SELECT COUNT(*) as c FROM users').get() as { c: number }).c;
  
  // Active in last 24h
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const activeUsers = (db.prepare('SELECT COUNT(*) as c FROM users WHERE last_activity >= ?').get(oneDayAgo) as { c: number }).c;

  const totalDownloads = (db.prepare("SELECT COUNT(*) as c FROM downloads WHERE status = 'completed'").get() as { c: number }).c;
  const mp3Downloads = (db.prepare("SELECT COUNT(*) as c FROM downloads WHERE status = 'completed' AND format = 'mp3'").get() as { c: number }).c;
  const videoDownloads = (db.prepare("SELECT COUNT(*) as c FROM downloads WHERE status = 'completed' AND (format = 'mp4' OR format = 'hd')").get() as { c: number }).c;
  const failedCount = (db.prepare("SELECT COUNT(*) as c FROM downloads WHERE status = 'failed'").get() as { c: number }).c;

  const platformRows = db.prepare('SELECT platform, COUNT(*) as c FROM downloads GROUP BY platform').all() as Array<{ platform: string; c: number }>;
  const platformStats: Record<string, number> = {
    tiktok: 0,
    youtube: 0,
    instagram: 0,
    facebook: 0,
  };
  for (const row of platformRows) {
    platformStats[row.platform.toLowerCase()] = row.c;
  }

  const recentDownloads = db.prepare('SELECT * FROM downloads ORDER BY created_at DESC LIMIT 20').all() as DownloadRecord[];

  return {
    totalUsers,
    activeUsers,
    totalDownloads,
    mp3Downloads,
    videoDownloads,
    platformStats,
    recentDownloads,
    failedCount,
  };
}

// Rate Limiter
export function checkRateLimit(key: string, limit: number, windowSeconds = 60): { allowed: boolean; remaining: number } {
  const db = getDatabase();
  const now = Math.floor(Date.now() / 1000);

  const row = db.prepare('SELECT * FROM rate_limits WHERE key = ?').get(key) as { key: string; count: number; reset_at: number } | undefined;

  if (!row || now > row.reset_at) {
    const resetAt = now + windowSeconds;
    db.prepare(`
      INSERT INTO rate_limits (key, count, reset_at)
      VALUES (?, 1, ?)
      ON CONFLICT(key) DO UPDATE SET count = 1, reset_at = ?
    `).run(key, resetAt, resetAt);

    return { allowed: true, remaining: limit - 1 };
  }

  if (row.count >= limit) {
    return { allowed: false, remaining: 0 };
  }

  db.prepare('UPDATE rate_limits SET count = count + 1 WHERE key = ?').run(key);
  return { allowed: true, remaining: limit - (row.count + 1) };
}
