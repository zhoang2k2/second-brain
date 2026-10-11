import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { execFile } from 'node:child_process';
import { FastifyInstance } from 'fastify';
import { createServer } from '../../apps/runtime/src/server/create-server';
import { openStore, Store } from '../../apps/runtime/src/storage/database';
import { RegisteredRootPolicy } from '../../apps/runtime/src/adapters/filesystem/registered-paths';
import { LocalSessionManager } from '../../apps/runtime/src/server/local-session';
import { runCli } from '../../apps/cli/src/main';
import { createDefaultDeps, CliIO } from '../../apps/cli/src/client';

describe('Real CLI process and runtime integration with disposable data', () => {
  let server: FastifyInstance;
  let store: Store;
  let tempDir: string;
  let stateFilePath: string;
  let runtimeUrl: string;
  let allowedProjDir: string;
  let allowedVaultDir: string;
  const port = 4199;

  beforeAll(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zhon-cli-integration-'));
    const dbPath = path.join(tempDir, 'cli.db');
    stateFilePath = path.join(tempDir, 'runtime.json');
    allowedProjDir = path.join(tempDir, 'sample-project');
    allowedVaultDir = path.join(tempDir, 'sample-vault');
    fs.mkdirSync(allowedProjDir, { recursive: true });
    fs.mkdirSync(allowedVaultDir, { recursive: true });

    store = openStore(dbPath);
    const policy = new RegisteredRootPolicy([tempDir]);
    const sessionManager = new LocalSessionManager({
      allowedOrigins: ['http://localhost:3000', 'http://127.0.0.1:3000', `http://127.0.0.1:${port}`],
      requireSession: true
    });
    const bootstrapCode = sessionManager.generateBootstrapCode('cli');

    server = await createServer({
      store,
      clock: () => '2026-10-10T12:00:00Z',
      registeredRootPolicy: policy,
      localSessionConfig: {
        allowedOrigins: ['http://localhost:3000', 'http://127.0.0.1:3000', `http://127.0.0.1:${port}`],
        requireSession: true
      },
      sessionManager
    });

    await server.listen({ host: '127.0.0.1', port });
    runtimeUrl = `http://127.0.0.1:${port}`;

    fs.writeFileSync(
      stateFilePath,
      JSON.stringify({
        pid: process.pid,
        port,
        host: '127.0.0.1',
        bootstrapCode
      }),
      { mode: 0o600 }
    );
  });

  afterAll(async () => {
    try {
      await server.close();
    } catch {}
    try {
      store.close();
    } catch {}
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('runs zhon status against live runtime successfully', async () => {
    const outputs: string[] = [];
    const errors: string[] = [];
    const io: CliIO = {
      out: (t) => outputs.push(t),
      err: (t) => errors.push(t)
    };

    const deps = createDefaultDeps({
      runtimeUrl,
      stateFilePath
    });

    const exitCode = await runCli(['status'], io, deps);
    expect(exitCode).toBe(0);
    expect(outputs.join('\n')).toContain('Runtime is healthy and ready');
    expect(errors).toHaveLength(0);
  });

  it('registers project and vault with real session bootstrap without leaking tokens', async () => {
    const outputs: string[] = [];
    const errors: string[] = [];
    const io: CliIO = {
      out: (t) => outputs.push(t),
      err: (t) => errors.push(t)
    };

    const deps = createDefaultDeps({
      runtimeUrl,
      stateFilePath
    });

    // 1. Register project
    const projCode = await runCli(['project', 'register', allowedProjDir], io, deps);
    expect(projCode).toBe(0);
    expect(outputs.join('\n')).toContain('Project registered successfully');

    // 2. Register vault
    const vaultCode = await runCli(['vault', 'register', allowedVaultDir], io, deps);
    expect(vaultCode).toBe(0);
    expect(outputs.join('\n')).toContain('Vault registered successfully');

    // 3. Verify in SQLite database
    const savedProjects = store.connection.prepare('SELECT * FROM projects').all();
    expect(savedProjects).toHaveLength(1);

    const savedVaults = store.connection.prepare('SELECT * FROM vaults').all();
    expect(savedVaults).toHaveLength(1);
  });

  it('runs executable apps/cli/bin/zhon process via execFile', async () => {
    const binPath = path.resolve(__dirname, '../../apps/cli/bin/zhon');
    const { stdout, stderr } = await new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
      execFile(
        binPath,
        ['status'],
        {
          env: {
            ...process.env,
            ZHON_RUNTIME_URL: runtimeUrl,
            ZHON_RUNTIME_STATE: stateFilePath
          }
        },
        (err, out, errOut) => {
          if (err) return reject(new Error(`Exit error: ${err.message}, stderr: ${errOut}`));
          resolve({ stdout: out, stderr: errOut });
        }
      );
    });

    expect(stdout).toContain('Runtime is healthy and ready');
    expect(stderr).toBe('');
  });
});
