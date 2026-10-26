import fs from 'fs';
import path from 'path';
import { getDatabase } from './db.js';
import { logger } from '../utils/logger.js';

export function runMigrations(): void {
  const db = getDatabase();

  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL
    );
  `);

  const migrationsDir = path.resolve(process.cwd(), 'migrations');
  if (!fs.existsSync(migrationsDir)) {
    return;
  }

  const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();

  for (const file of files) {
    const applied = db.prepare('SELECT version FROM schema_migrations WHERE version = ?').get(file);
    if (!applied) {
      logger.info(`Miqrasiya tətbiq edilir: ${file}`);
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
      db.exec(sql);
      db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)').run(
        file,
        new Date().toISOString()
      );
      logger.info(`Miqrasiya tamamlandı: ${file}`);
    }
  }
}
