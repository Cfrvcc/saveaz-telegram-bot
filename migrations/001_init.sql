-- Save.az Downloader Bot Initial Database Schema

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
