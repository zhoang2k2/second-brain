import * as fs from 'node:fs';
import * as path from 'node:path';
import type Database from 'better-sqlite3';
import type { Result } from '@zhon/contracts';

export function singleVault(db: Database.Database): Result<{ id: string; root: string }> {
  const vaults = db.prepare('SELECT id, root FROM vaults').all() as Array<{ id: string; root: string }>;
  if (vaults.length !== 1) {
    return {
      ok: false,
      error: {
        code: vaults.length === 0 ? 'VAULT_NOT_FOUND' : 'VAULT_LIMIT',
        message: vaults.length === 0 ? 'Register a vault first.' : 'MVP supports one vault; multiple vaults require explicit recovery.',
        retryable: false,
      },
    };
  }
  return { ok: true, value: vaults[0] };
}

/** Recheck the pinned registered root and source at every approval/retrieval boundary. */
export function noteSource(db: Database.Database, relativePath: string):
  | { ok: true; path: string }
  | { ok: false; availability: 'missing' | 'unsafe' } {
  const vault = singleVault(db);
  if (!vault.ok) return { ok: false, availability: 'unsafe' };
  const root = path.resolve(vault.value.root);
  const source = path.resolve(root, relativePath);
  const relative = path.relative(root, source);
  if (path.isAbsolute(relativePath) || relative.startsWith('..') || path.isAbsolute(relative)) {
    return { ok: false, availability: 'unsafe' };
  }
  try {
    if (fs.realpathSync(root) !== root) return { ok: false, availability: 'unsafe' };
    const canonical = fs.realpathSync(source);
    const canonicalRelative = path.relative(root, canonical);
    if (canonicalRelative.startsWith('..') || path.isAbsolute(canonicalRelative) || !fs.statSync(canonical).isFile()) {
      return { ok: false, availability: 'unsafe' };
    }
    return { ok: true, path: canonical };
  } catch {
    return { ok: false, availability: 'missing' };
  }
}
