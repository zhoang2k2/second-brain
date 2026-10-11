import { it, expect } from 'vitest';
import { mkdtempSync, symlinkSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { openStore } from './database';

it('database_symlink_cannot_bypass_single_owner', () => {
  const root = mkdtempSync(join(tmpdir(), 'zhon-store-owner-'));
  const store = openStore(join(root, 'state.db'));
  let second: ReturnType<typeof openStore> | undefined;
  try {
    symlinkSync(join(root, 'state.db'), join(root, 'alias.db'));
    expect(() => { second = openStore(join(root, 'alias.db')); }).toThrow(/second runtime owner/);
  } finally {
    second?.close();
    store.close();
    rmSync(root, { recursive: true, force: true });
  }
});
