import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { openStore, Store } from '../storage/database';
import { RegisteredRootPolicy } from '../adapters/filesystem/registered-paths';
import { createServer } from './create-server';
import { EventStore } from './events';

interface ServerWithWatchers {
  getVaultWatchers: () => Map<string, unknown>;
}

describe('Server Vault Watcher Lifecycle', () => {
  let baseDir: string;
  let vaultRoot: string;
  let store: Store;
  let policy: RegisteredRootPolicy;
  let eventStore: EventStore;

  beforeEach(() => {
    baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zhon-server-watcher-test-'));
    vaultRoot = path.join(baseDir, 'vault');
    fs.mkdirSync(vaultRoot, { recursive: true });

    store = openStore(':memory:');
    policy = new RegisteredRootPolicy([vaultRoot]);
    eventStore = new EventStore();
  });

  afterEach(() => {
    store.close();
    fs.rmSync(baseDir, { recursive: true, force: true });
  });

  it('initializes vault watchers on startup for existing vaults in db', async () => {
    const vaultId = 'vault-init-1';
    store.connection.prepare(
      'INSERT INTO vaults (id, root, version, created_at) VALUES (?, ?, ?, ?)'
    ).run(vaultId, fs.realpathSync(vaultRoot), 1, new Date().toISOString());

    const app = await createServer({
      store,
      clock: () => new Date().toISOString(),
      registeredRootPolicy: policy,
      localSessionConfig: { requireSession: false, allowedOrigins: ['http://localhost:3000'] },
      eventStore
    });

    const watchers = (app as unknown as ServerWithWatchers).getVaultWatchers();
    expect(watchers.has(vaultId)).toBe(true);

    await app.close();
    expect(watchers.size).toBe(0);
  });

  it('attaches new vault watcher when vault is registered and closes on shutdown', async () => {
    const app = await createServer({
      store,
      clock: () => new Date().toISOString(),
      registeredRootPolicy: policy,
      localSessionConfig: { requireSession: false, allowedOrigins: ['http://localhost:3000'] },
      eventStore
    });

    const watchers = (app as unknown as ServerWithWatchers).getVaultWatchers();
    expect(watchers.size).toBe(0);

    // Register vault via API
    const res = await app.inject({
      method: 'POST',
      url: '/v1/commands/registerVault',
      payload: {
        requestId: 'req-vault-1',
        idempotencyKey: 'idem-vault-1',
        payload: {
          root: vaultRoot
        }
      }
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.ok).toBe(true);

    const vaultId = body.value.id;
    expect(watchers.has(vaultId)).toBe(true);

    // Close app shuts down watchers
    await app.close();
    expect(watchers.size).toBe(0);
  });
});
