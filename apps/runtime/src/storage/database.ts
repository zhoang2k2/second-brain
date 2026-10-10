import * as fs from 'node:fs';
import * as path from 'node:path';
import Database from 'better-sqlite3';
import { runMigrations } from './migrations';

export interface Store {
  readonly connection: Database.Database;
  transaction<T>(fn: () => T): T;
  close(): void;
  schemaVersion(): number;
}

// Atomic exclusive-create lock; stale locks require deliberate recovery.
const activeStores = new Map<string, { pid: number; lockPath?: string }>();

export function openStore(dbPath: string): Store {
  const isMemory = dbPath === ':memory:';
  let resolvedPath = ':memory:';
  if (!isMemory) {
    const absolutePath = path.resolve(dbPath);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    resolvedPath = fs.existsSync(absolutePath)
      ? fs.realpathSync(absolutePath)
      : path.join(fs.realpathSync(path.dirname(absolutePath)), path.basename(absolutePath));
  }
  const lockPath = isMemory ? undefined : `${resolvedPath}.lock`;
  if (lockPath) {
    try {
      fs.writeFileSync(lockPath, JSON.stringify({ pid: process.pid, acquiredAt: new Date().toISOString() }), { flag: 'wx', mode: 0o600 });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
        throw new Error(`Database locked (rejects second runtime owner): ${resolvedPath}. Verify the owner is stopped before manually recovering a stale lock.`);
      }
      throw error;
    }
    activeStores.set(resolvedPath, { pid: process.pid, lockPath });
  }
  let db: Database.Database;
  let currentSchemaVersion: number;
  try {
    db = new Database(resolvedPath);
    db.pragma('journal_mode = WAL');
    db.pragma('busy_timeout = 5000');
    db.pragma('synchronous = FULL');
    currentSchemaVersion = runMigrations(db);
  } catch (error) {
    if (lockPath) {
      activeStores.delete(resolvedPath);
      fs.unlinkSync(lockPath);
    }
    throw error;
  }

  let closed = false;

  const store: Store = {
    get connection() {
      if (closed) {
        throw new Error('Store is closed');
      }
      return db;
    },
    transaction<T>(fn: () => T): T {
      if (closed) {
        throw new Error('Store is closed');
      }
      return db.transaction(fn)();
    },
    schemaVersion(): number {
      return currentSchemaVersion;
    },
    close(): void {
      if (closed) {
        return;
      }
      closed = true;

      try {
        db.close();
      } catch {
        // Ignore if already closed
      }

      if (!isMemory && lockPath) {
        activeStores.delete(resolvedPath);
        try {
          if (fs.existsSync(lockPath)) {
            fs.unlinkSync(lockPath);
          }
        } catch {
          // Ignore
        }
      }
    }
  };

  return store;
}
