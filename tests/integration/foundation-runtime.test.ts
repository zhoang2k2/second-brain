import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { FastifyInstance } from 'fastify';
import { createServer } from '../../apps/runtime/src/server/create-server';
import { openStore, Store } from '../../apps/runtime/src/storage/database';
import { RegisteredRootPolicy } from '../../apps/runtime/src/adapters/filesystem/registered-paths';
import { Project, Result } from '@zhon/contracts';
import { LocalSessionManager } from '../../apps/runtime/src/server/local-session';

interface RuntimeFixture {
  server: FastifyInstance;
  store: Store;
  tempDir: string;
  allowedRoot: string;
  dbPath: string;
  createSession: (origin?: string) => string;
  commandFromOrigin: (origin: string, commandName: string, payload?: unknown, sessionId?: string) => Promise<Result<unknown>>;
  registerEscapingSymlink: () => Promise<Result<Project>>;
  restartAndListProjects: () => Promise<Project[]>;
  cleanup: () => Promise<void>;
}

async function createRuntimeFixture(): Promise<RuntimeFixture> {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zhon-runtime-integration-'));
  const dbPath = path.join(tempDir, 'runtime.db');
  const allowedRoot = path.join(tempDir, 'allowed');
  const outsideRoot = path.join(tempDir, 'outside');
  fs.mkdirSync(allowedRoot, { recursive: true });
  fs.mkdirSync(outsideRoot, { recursive: true });

  const store = openStore(dbPath);
  const policy = new RegisteredRootPolicy([allowedRoot]);
  const clock = () => '2026-10-10T12:00:00Z';
  const localSessionConfig = {
    allowedOrigins: ['http://localhost:3000', 'http://127.0.0.1:3000'],
    requireSession: true
  };

  const server = await createServer({
    store,
    clock,
    registeredRootPolicy: policy,
    localSessionConfig
  });

  const sessionManager = (server as unknown as { sessionManager: LocalSessionManager }).sessionManager;
  const createSession = (origin = 'http://localhost:3000') => {
    const code = sessionManager.generateBootstrapCode();
    const res = sessionManager.createLocalSession({ bootstrapCode: code, origin });
    if (!res.ok) throw new Error(res.error.message);
    return res.value.sessionId;
  };

  return {
    server,
    store,
    tempDir,
    allowedRoot,
    dbPath,
    createSession,
    commandFromOrigin: async (origin: string, commandName: string, payload: unknown = { root: path.join(allowedRoot, 'p1') }, sessionId?: string) => {
      const headers: Record<string, string> = {
        origin,
        'content-type': 'application/json'
      };
      if (sessionId) {
        headers['x-session-id'] = sessionId;
      }
      const res = await server.inject({
        method: 'POST',
        url: `/v1/commands/${commandName}`,
        headers,
        payload: {
          requestId: 'req-1',
          idempotencyKey: 'idem-1',
          payload
        }
      });
      try {
        return JSON.parse(res.body);
      } catch {
        return { ok: false, error: { code: 'HTTP_ERROR_' + res.statusCode, message: res.body, retryable: false } };
      }
    },
    registerEscapingSymlink: async () => {
      const sessionId = createSession();
      const symlinkPath = path.join(allowedRoot, 'escaped-link');
      if (!fs.existsSync(symlinkPath)) {
        fs.symlinkSync(outsideRoot, symlinkPath, 'dir');
      }
      const res = await server.inject({
        method: 'POST',
        url: '/v1/commands/registerProject',
        headers: {
          origin: 'http://localhost:3000',
          'x-session-id': sessionId,
          'content-type': 'application/json'
        },
        payload: {
          requestId: 'req-symlink',
          idempotencyKey: 'idem-symlink',
          payload: { root: symlinkPath }
        }
      });
      return JSON.parse(res.body);
    },
    restartAndListProjects: async () => {
      await server.close();
      store.close();

      const newStore = openStore(dbPath);
      const newServer = await createServer({
        store: newStore,
        clock,
        registeredRootPolicy: policy,
        localSessionConfig
      });

      const res = await newServer.inject({
        method: 'GET',
        url: '/v1/projects',
        headers: {
          origin: 'http://localhost:3000'
        }
      });

      const data = JSON.parse(res.body);
      await newServer.close();
      newStore.close();

      return data.ok ? data.value : data;
    },
    cleanup: async () => {
      try {
        await server.close();
      } catch {
        // ignore
      }
      try {
        store.close();
      } catch {
        // ignore
      }
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  };
}

describe('foundation-runtime integration tests', () => {
  let fixture: RuntimeFixture;

  beforeEach(async () => {
    fixture = await createRuntimeFixture();
  });

  afterEach(async () => {
    await fixture.cleanup();
  });

  it('rejects_bad_origin', async () => {
    const sessionId = fixture.createSession();
    const res = await fixture.commandFromOrigin('https://other.example', 'registerProject', undefined, sessionId);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.code).toBe('FORBIDDEN_ORIGIN');
    }
  });

  it('rejects_null_origin', async () => {
    const sessionId = fixture.createSession();
    const res = await fixture.commandFromOrigin('null', 'registerProject', undefined, sessionId);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.code).toBe('FORBIDDEN_ORIGIN');
    }
  });

  it('rejects_mutation_without_session', async () => {
    const res = await fixture.server.inject({
      method: 'POST',
      url: '/v1/commands/registerProject',
      headers: {
        origin: 'http://localhost:3000',
        'content-type': 'application/json'
      },
      payload: {
        requestId: 'req-no-sess',
        idempotencyKey: 'idem-no-sess',
        payload: { root: path.join(fixture.allowedRoot, 'p-unauth') }
      }
    });
    expect(res.statusCode).toBe(401);
    const body = JSON.parse(res.body);
    expect(body.error.code).toBe('UNAUTHORIZED_SESSION');
  });

  it('rejects_replayed_bootstrap_over_http', async () => {
    const sessionManager = (fixture.server as unknown as { sessionManager: LocalSessionManager }).sessionManager;
    const bootstrapCode = sessionManager.generateBootstrapCode();

    // 1st attempt: success
    const res1 = await fixture.server.inject({
      method: 'POST',
      url: '/v1/session/bootstrap',
      headers: {
        origin: 'http://localhost:3000',
        'content-type': 'application/json'
      },
      payload: { bootstrapCode }
    });
    expect(res1.statusCode).toBe(200);
    const body1 = JSON.parse(res1.body);
    expect(body1.ok).toBe(true);

    // 2nd attempt: replay attack must be rejected
    const res2 = await fixture.server.inject({
      method: 'POST',
      url: '/v1/session/bootstrap',
      headers: {
        origin: 'http://localhost:3000',
        'content-type': 'application/json'
      },
      payload: { bootstrapCode }
    });
    expect(res2.statusCode).toBe(403);
    const body2 = JSON.parse(res2.body);
    expect(body2.ok).toBe(false);
    expect(body2.error.code).toBe('INVALID_BOOTSTRAP_CODE');
  });

  it('rejects_arbitrary_path_escape', async () => {
    const symlinkResult = await fixture.registerEscapingSymlink();
    expect(symlinkResult.ok).toBe(false);
    if (!symlinkResult.ok) {
      expect(symlinkResult.error.code).toBe('PATH_OUT_OF_SCOPE');
    }
  });

  it('persists_registration_after_restart', async () => {
    const projDir = path.join(fixture.allowedRoot, 'p-real');
    fs.mkdirSync(projDir, { recursive: true });

    const sessionId = fixture.createSession();

    const regRes = await fixture.server.inject({
      method: 'POST',
      url: '/v1/commands/registerProject',
      headers: {
        origin: 'http://localhost:3000',
        'x-session-id': sessionId,
        'content-type': 'application/json'
      },
      payload: {
        requestId: 'req-reg',
        idempotencyKey: 'idem-reg',
        payload: { root: projDir }
      }
    });

    const parsed = JSON.parse(regRes.body);
    expect(parsed.ok).toBe(true);

    const projects = await fixture.restartAndListProjects();
    expect(projects).toHaveLength(1);
    expect(projects[0].root).toBe(fs.realpathSync(projDir));
  });

  it('rejects_second_runtime_owner', () => {
    // Attempting to open the same database while fixture.store is open
    expect(() => {
      openStore(fixture.dbPath);
    }).toThrow(/second runtime owner|locked/i);
  });

  it('rejects_bad_host', async () => {
    const res = await fixture.server.inject({
      method: 'GET',
      url: '/v1/health',
      headers: {
        host: 'evil.attacker.com'
      }
    });
    expect(res.statusCode).toBe(403);
    const body = JSON.parse(res.body);
    expect(body.error.code).toBe('FORBIDDEN_HOST');
  });

  it('rejects_invalid_mutation_session', async () => {
    const res = await fixture.server.inject({
      method: 'POST',
      url: '/v1/commands/registerProject',
      headers: {
        origin: 'http://localhost:3000',
        'x-session-id': 'invalid-session-token',
        'content-type': 'application/json'
      },
      payload: {
        requestId: 'req-bad-session',
        idempotencyKey: 'idem-bad-session',
        payload: { root: fixture.allowedRoot }
      }
    });
    expect(res.statusCode).toBe(401);
    const body = JSON.parse(res.body);
    expect(body.error.code).toBe('UNAUTHORIZED_SESSION');
  });
  it('malformed_command_envelopes_cannot_write_state_or_events', async () => {
    const sessionId = fixture.createSession();
    const validPayload = { root: fixture.allowedRoot };
    for (const body of [
      { payload: validPayload },
      { requestId: 12, idempotencyKey: 'key', payload: validPayload },
      { requestId: 'request', idempotencyKey: 'key', expectedVersion: 'old', payload: validPayload },
      { requestId: 'request', idempotencyKey: 'key', grantAll: true, payload: validPayload },
    ]) {
      for (const route of ['registerProject', 'registerVault']) {
        const response = await fixture.server.inject({ method: 'POST', url: `/v1/commands/${route}`, headers: { origin: 'http://localhost:3000', 'x-session-id': sessionId }, payload: body });
        expect(response.statusCode).toBe(400);
        expect(response.json().error.code).toBe('INVALID_COMMAND');
      }
    }
    expect(fixture.store.connection.prepare('SELECT COUNT(*) AS count FROM projects').get()).toEqual({ count: 0 });
    expect(fixture.store.connection.prepare('SELECT COUNT(*) AS count FROM vaults').get()).toEqual({ count: 0 });
    expect(fixture.store.connection.prepare('SELECT COUNT(*) AS count FROM events').get()).toEqual({ count: 0 });
  });

});

