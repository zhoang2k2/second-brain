import { registerCheck } from '../registry';
import { RegistrationInputSchema } from '@zhon/contracts';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { openStore } from '../../../apps/runtime/src/storage/database';
import { createServer } from '../../../apps/runtime/src/server/create-server';
import { RegisteredRootPolicy } from '../../../apps/runtime/src/adapters/filesystem/registered-paths';
import { LocalSessionManager } from '../../../apps/runtime/src/server/local-session';
import { runCli } from '../../../apps/cli/src/main';
import { createDefaultDeps, CliIO } from '../../../apps/cli/src/client';

// 1. Contracts & Schemas Gate
registerCheck('P0', 'foundation_contracts_schema_check', async () => {
  try {
    const validInput = { root: '/valid/fixture/root' };
    const validParsed = RegistrationInputSchema.safeParse(validInput);
    if (!validParsed.success) {
      return { name: 'foundation_contracts_schema_check', status: 'FAIL', reason: 'Valid input failed schema' };
    }

    // Must reject injected extra fields (strict schema)
    const injectedInput = { root: '/valid/fixture/root', grantAll: true };
    const injectedParsed = RegistrationInputSchema.safeParse(injectedInput);
    if (injectedParsed.success) {
      return { name: 'foundation_contracts_schema_check', status: 'FAIL', reason: 'Schema allowed injected extra field (grantAll)' };
    }

    // Must reject path traversal (..)
    const traversalInput = { root: '/valid/fixture/../escaped' };
    const traversalParsed = RegistrationInputSchema.safeParse(traversalInput);
    if (traversalParsed.success) {
      return { name: 'foundation_contracts_schema_check', status: 'FAIL', reason: 'Schema allowed path traversal (..)' };
    }

    return { name: 'foundation_contracts_schema_check', status: 'PASS' };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { name: 'foundation_contracts_schema_check', status: 'FAIL', reason: msg };
  }
});

// 2. Storage, WAL & Single-Writer Lock Gate
registerCheck('P0', 'foundation_storage_and_migrations_check', async () => {
  const migrationPath = path.resolve(process.cwd(), 'apps/runtime/src/storage/migrations/001_foundation.sql');
  if (!fs.existsSync(migrationPath)) {
    return { name: 'foundation_storage_and_migrations_check', status: 'BLOCKED', reason: 'Missing prerequisite: 001_foundation.sql not found' };
  }

  const migrationSql = fs.readFileSync(migrationPath, 'utf-8');
  if (!migrationSql.includes('projects') || !migrationSql.includes('vaults') || !migrationSql.includes('events')) {
    return { name: 'foundation_storage_and_migrations_check', status: 'FAIL', reason: '001_foundation.sql missing required table schemas' };
  }

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zhon-acceptance-store-'));
  const dbPath = path.join(tempDir, 'acceptance.db');

  try {
    const store1 = openStore(dbPath);

    // Verify WAL mode
    const pragmaRes = store1.connection.pragma('journal_mode', { simple: true });
    if (pragmaRes !== 'wal') {
      store1.close();
      fs.rmSync(tempDir, { recursive: true, force: true });
      return { name: 'foundation_storage_and_migrations_check', status: 'FAIL', reason: `Expected WAL journal mode, got ${pragmaRes}` };
    }

    // Verify single-writer lock rejects second opener
    let rejectedSecond = false;
    try {
      openStore(dbPath);
    } catch {
      rejectedSecond = true;
    }

    store1.close();
    fs.rmSync(tempDir, { recursive: true, force: true });

    if (!rejectedSecond) {
      return { name: 'foundation_storage_and_migrations_check', status: 'FAIL', reason: 'Second runtime owner was not rejected' };
    }

    return { name: 'foundation_storage_and_migrations_check', status: 'PASS' };
  } catch (err: unknown) {
    fs.rmSync(tempDir, { recursive: true, force: true });
    const msg = err instanceof Error ? err.message : String(err);
    return { name: 'foundation_storage_and_migrations_check', status: 'FAIL', reason: msg };
  }
});

// 3. Loopback, Origin & Session Security Gate
registerCheck('P0', 'foundation_loopback_and_session_security_check', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zhon-acceptance-security-'));
  const dbPath = path.join(tempDir, 'sec.db');

  try {
    const store = openStore(dbPath);
    const policy = new RegisteredRootPolicy([tempDir]);
    const sessionManager = new LocalSessionManager({
      allowedOrigins: ['http://localhost:3000', 'http://127.0.0.1:3000'],
      requireSession: true
    });
    const server = await createServer({
      store,
      clock: () => '2026-10-10T12:00:00Z',
      registeredRootPolicy: policy,
      localSessionConfig: {
        allowedOrigins: ['http://localhost:3000', 'http://127.0.0.1:3000'],
        requireSession: true
      },
      sessionManager
    });

    // 1. Host check
    const badHostRes = await server.inject({
      method: 'GET',
      url: '/v1/health',
      headers: { host: 'evil.attacker.com' }
    });
    if (badHostRes.statusCode !== 403) {
      await server.close();
      store.close();
      fs.rmSync(tempDir, { recursive: true, force: true });
      return { name: 'foundation_loopback_and_session_security_check', status: 'FAIL', reason: 'Server did not reject foreign host with 403' };
    }

    // 2. Foreign origin check
    const badOriginRes = await server.inject({
      method: 'POST',
      url: '/v1/commands/registerProject',
      headers: { origin: 'https://attacker.com', 'content-type': 'application/json' },
      payload: { requestId: 'r1', idempotencyKey: 'i1', payload: { root: tempDir } }
    });
    if (badOriginRes.statusCode !== 403) {
      await server.close();
      store.close();
      fs.rmSync(tempDir, { recursive: true, force: true });
      return { name: 'foundation_loopback_and_session_security_check', status: 'FAIL', reason: 'Server did not reject foreign origin with 403' };
    }

    // 3. Unauthenticated mutation check
    const unauthRes = await server.inject({
      method: 'POST',
      url: '/v1/commands/registerProject',
      headers: { origin: 'http://localhost:3000', 'content-type': 'application/json' },
      payload: { requestId: 'r2', idempotencyKey: 'i2', payload: { root: tempDir } }
    });
    if (unauthRes.statusCode !== 401) {
      await server.close();
      store.close();
      fs.rmSync(tempDir, { recursive: true, force: true });
      return { name: 'foundation_loopback_and_session_security_check', status: 'FAIL', reason: 'Server allowed unauthenticated mutation' };
    }

    // 4. One-time bootstrap replay attack check
    const code = sessionManager.generateBootstrapCode();
    const boot1 = await server.inject({
      method: 'POST',
      url: '/v1/session/bootstrap',
      headers: { origin: 'http://localhost:3000', 'content-type': 'application/json' },
      payload: { bootstrapCode: code }
    });
    if (boot1.statusCode !== 200) {
      await server.close();
      store.close();
      fs.rmSync(tempDir, { recursive: true, force: true });
      return { name: 'foundation_loopback_and_session_security_check', status: 'FAIL', reason: 'Valid bootstrap failed' };
    }

    const boot2 = await server.inject({
      method: 'POST',
      url: '/v1/session/bootstrap',
      headers: { origin: 'http://localhost:3000', 'content-type': 'application/json' },
      payload: { bootstrapCode: code }
    });
    if (boot2.statusCode !== 403) {
      await server.close();
      store.close();
      fs.rmSync(tempDir, { recursive: true, force: true });
      return { name: 'foundation_loopback_and_session_security_check', status: 'FAIL', reason: 'Replayed bootstrap was not rejected' };
    }

    await server.close();
    store.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
    return { name: 'foundation_loopback_and_session_security_check', status: 'PASS' };
  } catch (err: unknown) {
    fs.rmSync(tempDir, { recursive: true, force: true });
    const msg = err instanceof Error ? err.message : String(err);
    return { name: 'foundation_loopback_and_session_security_check', status: 'FAIL', reason: msg };
  }
});

// 4. CLI Execution with Real Disposable Data Gate
registerCheck('P0', 'foundation_cli_execution_check', async () => {
  const binPath = path.resolve(process.cwd(), 'apps/cli/bin/zhon');
  if (!fs.existsSync(binPath)) {
    return { name: 'foundation_cli_execution_check', status: 'BLOCKED', reason: 'Missing prerequisite: apps/cli/bin/zhon does not exist' };
  }

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zhon-acceptance-cli-'));
  const dbPath = path.join(tempDir, 'cli.db');
  const statePath = path.join(tempDir, 'runtime.json');
  const disposableProj = path.join(tempDir, 'sample-proj');
  fs.mkdirSync(disposableProj, { recursive: true });

  const port = 4198;
  const runtimeUrl = `http://127.0.0.1:${port}`;

  try {
    const store = openStore(dbPath);
    const policy = new RegisteredRootPolicy([tempDir]);
    const sessionManager = new LocalSessionManager({
      allowedOrigins: ['http://localhost:3000', 'http://127.0.0.1:3000', runtimeUrl],
      requireSession: true
    });
    const bootstrapCode = sessionManager.generateBootstrapCode('cli');

    const server = await createServer({
      store,
      clock: () => '2026-10-10T12:00:00Z',
      registeredRootPolicy: policy,
      localSessionConfig: {
        allowedOrigins: ['http://localhost:3000', 'http://127.0.0.1:3000', runtimeUrl],
        requireSession: true
      },
      sessionManager
    });

    await server.listen({ host: '127.0.0.1', port });
    fs.writeFileSync(statePath, JSON.stringify({ pid: process.pid, port, host: '127.0.0.1', bootstrapCode }), { mode: 0o600 });

    const outputs: string[] = [];
    const io: CliIO = {
      out: (t) => outputs.push(t),
      err: () => {}
    };
    const deps = createDefaultDeps({ runtimeUrl, stateFilePath: statePath });

    const statusCode = await runCli(['status'], io, deps);
    if (statusCode !== 0) {
      await server.close();
      store.close();
      fs.rmSync(tempDir, { recursive: true, force: true });
      return { name: 'foundation_cli_execution_check', status: 'FAIL', reason: `CLI status returned nonzero exit ${statusCode}` };
    }

    const regCode = await runCli(['project', 'register', disposableProj], io, deps);
    if (regCode !== 0) {
      await server.close();
      store.close();
      fs.rmSync(tempDir, { recursive: true, force: true });
      return { name: 'foundation_cli_execution_check', status: 'FAIL', reason: `CLI register returned nonzero exit ${regCode}` };
    }

    await server.close();
    store.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
    return { name: 'foundation_cli_execution_check', status: 'PASS' };
  } catch (err: unknown) {
    fs.rmSync(tempDir, { recursive: true, force: true });
    const msg = err instanceof Error ? err.message : String(err);
    return { name: 'foundation_cli_execution_check', status: 'FAIL', reason: msg };
  }
});

// 5. UI Shell & Design Tokens Conformance Gate
registerCheck('P0', 'foundation_ui_shell_tokens_check', async () => {
  const cssPath = path.resolve(process.cwd(), 'apps/web/src/features/shell/shell.css');
  if (!fs.existsSync(cssPath)) {
    return { name: 'foundation_ui_shell_tokens_check', status: 'BLOCKED', reason: 'Missing prerequisite: apps/web/src/features/shell/shell.css' };
  }

  const css = fs.readFileSync(cssPath, 'utf-8');
  if (!css.includes('--zhon-sidebar-width: 280px')) {
    return { name: 'foundation_ui_shell_tokens_check', status: 'FAIL', reason: 'Sidebar width token 280px missing' };
  }
  if (!css.includes('#0B6FB8') || !css.includes('#5A7400')) {
    return { name: 'foundation_ui_shell_tokens_check', status: 'FAIL', reason: 'Sky & Lime light accent palette colors missing' };
  }
  if (!css.includes('Be Vietnam Pro')) {
    return { name: 'foundation_ui_shell_tokens_check', status: 'FAIL', reason: 'Be Vietnam Pro font family token missing' };
  }
  if (!css.includes('prefers-reduced-motion')) {
    return { name: 'foundation_ui_shell_tokens_check', status: 'FAIL', reason: 'prefers-reduced-motion CSS block missing' };
  }

  return { name: 'foundation_ui_shell_tokens_check', status: 'PASS' };
});

// 6. Toolchain, Lockfile & Workspace Qualification Gate
registerCheck('P0', 'foundation_toolchain_and_lockfile_check', async () => {
  const lockfilePath = path.resolve(process.cwd(), 'pnpm-lock.yaml');
  if (!fs.existsSync(lockfilePath)) {
    return { name: 'foundation_toolchain_and_lockfile_check', status: 'BLOCKED', reason: 'Missing prerequisite: pnpm-lock.yaml does not exist' };
  }

  const lockContent = fs.readFileSync(lockfilePath, 'utf-8');
  if (!lockContent.includes('next@16.4.0')) {
    return { name: 'foundation_toolchain_and_lockfile_check', status: 'FAIL', reason: 'Lockfile does not pin Next.js 16.4.0' };
  }

  const nodeMajor = parseInt(process.versions.node.split('.')[0], 10);
  const nodeMinor = parseInt(process.versions.node.split('.')[1], 10);
  if (nodeMajor < 22 || (nodeMajor === 22 && nodeMinor < 19)) {
    return { name: 'foundation_toolchain_and_lockfile_check', status: 'BLOCKED', reason: `Node version ${process.versions.node} does not satisfy qualification >= 22.19.0` };
  }

  const workspacePath = path.resolve(process.cwd(), 'pnpm-workspace.yaml');
  if (!fs.existsSync(workspacePath)) {
    return { name: 'foundation_toolchain_and_lockfile_check', status: 'BLOCKED', reason: 'Missing prerequisite: pnpm-workspace.yaml does not exist' };
  }

  const qualification = openStore(':memory:');
  try {
    const version = qualification.connection.prepare('SELECT sqlite_version() AS version').get() as { version: string };
    const source = qualification.connection.prepare('SELECT sqlite_source_id() AS sourceId').get() as { sourceId: string };
    if (version.version !== '3.53.4') {
      return { name: 'foundation_toolchain_and_lockfile_check', status: 'BLOCKED', reason: `SQLite ${version.version} differs from qualified 3.53.4; review official release/security notes` };
    }
    return { name: 'foundation_toolchain_and_lockfile_check', status: 'PASS', reason: `Node ${process.versions.node}; SQLite ${version.version}; source ${source.sourceId}; qualification: docs/reports/P0/toolchain-qualification.md` };
  } finally { qualification.close(); }
});
