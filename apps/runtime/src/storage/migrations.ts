import * as fs from 'node:fs';
import * as path from 'node:path';
import type Database from 'better-sqlite3';

const FALLBACK_001_FOUNDATION_SQL = `
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  root TEXT NOT NULL UNIQUE,
  remote TEXT,
  version INTEGER NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS vaults (
  id TEXT PRIMARY KEY,
  root TEXT NOT NULL UNIQUE,
  version INTEGER NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS events (
  sequence INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  occurred_at TEXT NOT NULL,
  payload TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS processed_commands (
  idempotency_key TEXT PRIMARY KEY,
  request_id TEXT NOT NULL,
  command_name TEXT NOT NULL,
  payload_hash TEXT NOT NULL,
  result TEXT NOT NULL,
  created_at TEXT NOT NULL
);
`;

export function runMigrations(db: Database.Database): number {
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      applied_at TEXT NOT NULL
    );
  `);

  const appliedRows = db.prepare('SELECT name FROM _migrations').all() as { name: string }[];
  const appliedNames = new Set(appliedRows.map(r => r.name));

  // Determine migrations directory
  const migrationsDir = path.join(__dirname, 'migrations');
  const migrationFiles: { name: string; sql: string }[] = [];

  if (fs.existsSync(migrationsDir)) {
    const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();
    for (const f of files) {
      const sql = fs.readFileSync(path.join(migrationsDir, f), 'utf-8');
      migrationFiles.push({ name: f, sql });
    }
  }

  if (migrationFiles.length === 0) {
    migrationFiles.push({ name: '001_foundation.sql', sql: FALLBACK_001_FOUNDATION_SQL });
  }

  const insertMigration = db.prepare('INSERT INTO _migrations (name, applied_at) VALUES (?, ?)');

  for (const m of migrationFiles) {
    if (!appliedNames.has(m.name)) {
      db.transaction(() => {
        db.exec(m.sql);
        insertMigration.run(m.name, new Date().toISOString());
      })();
    }
  }

  const countRow = db.prepare('SELECT COUNT(*) as count FROM _migrations').get() as { count: number };
  return countRow.count;
}
