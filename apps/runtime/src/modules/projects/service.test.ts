import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { ProjectService } from './service';
import { openStore, Store } from '../../storage/database';
import { RegisteredRootPolicy } from '../../adapters/filesystem/registered-paths';
import { RegistrationInput, Project, Result, Command } from '@zhon/contracts';
import { EventStore } from '../../server/events';

interface TestFixture {
  service: ProjectService;
  store: Store;
  dbPath: string;
  tempDir: string;
  allowedRoot: string;
  clock: () => string;
  policy: RegisteredRootPolicy;
  registerEscapingSymlink: () => Promise<Result<Project>>;
  restartAndListProjects: () => Promise<Project[]>;
  cleanup: () => void;
}

function createFixture(): TestFixture {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zhon-service-test-'));
  const dbPath = path.join(tempDir, 'test.db');
  const allowedRoot = path.join(tempDir, 'allowed');
  const outsideRoot = path.join(tempDir, 'outside');
  fs.mkdirSync(allowedRoot, { recursive: true });
  fs.mkdirSync(outsideRoot, { recursive: true });

  const store = openStore(dbPath);
  const policy = new RegisteredRootPolicy([allowedRoot]);
  const clock = () => '2026-10-10T12:00:00Z';
  const service = new ProjectService({ store, clock, policy });

  return {
    service,
    store,
    dbPath,
    tempDir,
    allowedRoot,
    clock,
    policy,
    registerEscapingSymlink: async () => {
      // Symlink located inside allowedRoot but pointing outside allowedRoot
      const symlinkPath = path.join(allowedRoot, 'escaped-link');
      if (!fs.existsSync(symlinkPath)) {
        fs.symlinkSync(outsideRoot, symlinkPath, 'dir');
      }
      return service.registerProject({ root: symlinkPath });
    },
    restartAndListProjects: async () => {
      store.close();
      const reopenedStore = openStore(dbPath);
      const reopenedService = new ProjectService({ store: reopenedStore, clock, policy });
      const projects = reopenedService.listProjects();
      reopenedStore.close();
      return projects;
    },
    cleanup: () => {
      try {
        store.close();
      } catch {
        // Already closed in restart
      }
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  };
}

describe('ProjectService', () => {
  let fixture: TestFixture;

  beforeEach(() => {
    fixture = createFixture();
  });

  afterEach(() => {
    fixture.cleanup();
  });

  it('rejects_arbitrary_path_escape', async () => {
    // 1. Path traversal escape
    const traversalResult = await fixture.service.registerProject({
      root: path.join(fixture.allowedRoot, '../outside')
    } as RegistrationInput);
    expect(traversalResult.ok).toBe(false);
    if (!traversalResult.ok) {
      expect(traversalResult.error.code).toBe('PATH_OUT_OF_SCOPE');
    }

    // 2. Symlink escape check
    const symlinkResult = await fixture.registerEscapingSymlink();
    expect(symlinkResult.ok).toBe(false);
    if (!symlinkResult.ok) {
      expect(symlinkResult.error.code).toBe('PATH_OUT_OF_SCOPE');
    }
    expect(((await fixture.registerEscapingSymlink()) as { error: { code: string } }).error.code).toBe('PATH_OUT_OF_SCOPE');
  });

  it('persists_registration_after_restart', async () => {
    const validDir = path.join(fixture.allowedRoot, 'valid-proj');
    fs.mkdirSync(validDir, { recursive: true });

    const registered = await fixture.service.registerProject({ root: validDir });
    expect(registered.ok).toBe(true);

    const projects = await fixture.restartAndListProjects();
    expect(projects).toHaveLength(1);
    expect(projects[0].root).toBe(fs.realpathSync(validDir));
  });

  it('event_state_transaction_rolls_back_on_error', async () => {
    const validDir = path.join(fixture.allowedRoot, 'rollback-proj');
    fs.mkdirSync(validDir, { recursive: true });

    // When an error is triggered during event persistence,
    // the transaction must roll back so the project is NOT stored in DB.
    const failingService = new ProjectService({
      store: fixture.store,
      clock: () => '2026-10-10T12:00:00Z',
      policy: new RegisteredRootPolicy([fixture.allowedRoot]),
      forceEventError: true
    });

    const res = await failingService.registerProject({ root: validDir });
    expect(res.ok).toBe(false);

    // Verify project table is empty
    const list = fixture.service.listProjects();
    expect(list).toHaveLength(0);

    // Verify events table has no event for this project
    const rawEvents = fixture.store.connection.prepare('SELECT * FROM events').all();
    expect(rawEvents).toHaveLength(0);
  });

  it('replay_with_same_key_and_payload_returns_same_result_without_extra_events', async () => {
    const validDir = path.join(fixture.allowedRoot, 'idempotent-proj');
    fs.mkdirSync(validDir, { recursive: true });

    const cmd: Command<RegistrationInput> = {
      requestId: 'req-idem-1',
      idempotencyKey: 'idem-key-1',
      payload: { root: validDir }
    };

    const res1 = await fixture.service.registerProject(cmd);
    expect(res1.ok).toBe(true);
    if (!res1.ok) return;

    // Track event count in db
    const initialEvents = fixture.store.connection.prepare('SELECT * FROM events').all();
    expect(initialEvents).toHaveLength(1);

    // Replay exact same command
    const res2 = await fixture.service.registerProject(cmd);
    expect(res2.ok).toBe(true);
    if (!res2.ok) return;

    // Result should match
    expect(res2.value).toEqual(res1.value);

    // Should NOT append extra events
    const afterEvents = fixture.store.connection.prepare('SELECT * FROM events').all();
    expect(afterEvents).toHaveLength(1);
  });

  it('reused_idempotency_key_with_different_payload_is_rejected', async () => {
    const dir1 = path.join(fixture.allowedRoot, 'proj-1');
    const dir2 = path.join(fixture.allowedRoot, 'proj-2');
    fs.mkdirSync(dir1, { recursive: true });
    fs.mkdirSync(dir2, { recursive: true });

    const cmd1: Command<RegistrationInput> = {
      requestId: 'req-1',
      idempotencyKey: 'shared-key',
      payload: { root: dir1 }
    };

    const res1 = await fixture.service.registerProject(cmd1);
    expect(res1.ok).toBe(true);

    // Reusing same idempotencyKey with different payload
    const cmd2: Command<RegistrationInput> = {
      requestId: 'req-2',
      idempotencyKey: 'shared-key',
      payload: { root: dir2 }
    };

    const res2 = await fixture.service.registerProject(cmd2);
    expect(res2.ok).toBe(false);
    if (!res2.ok) {
      expect(res2.error.code).toBe('IDEMPOTENCY_CONFLICT');
    }

    // Also check that dir2 was NOT registered
    const projects = fixture.service.listProjects();
    expect(projects).toHaveLength(1);
    expect(projects[0].root).toBe(fs.realpathSync(dir1));
  });

  it('stale_expected_version_is_rejected_without_changing_state', async () => {
    const dir = path.join(fixture.allowedRoot, 'versioned-proj');
    fs.mkdirSync(dir, { recursive: true });

    // 1. New resource with expectedVersion !== 0 (e.g. expectedVersion: 1) should be rejected
    const newWithStaleVersion: Command<RegistrationInput> = {
      requestId: 'req-v0',
      idempotencyKey: 'key-v0',
      expectedVersion: 1,
      payload: { root: dir }
    };
    const rejectNew = await fixture.service.registerProject(newWithStaleVersion);
    expect(rejectNew.ok).toBe(false);
    if (!rejectNew.ok) {
      expect(rejectNew.error.code).toBe('VERSION_CONFLICT');
    }
    expect(fixture.service.listProjects()).toHaveLength(0);

    // 2. Register valid project (expectedVersion: 0 or undefined) -> version becomes 1
    const initialCmd: Command<RegistrationInput> = {
      requestId: 'req-v1',
      idempotencyKey: 'key-v1',
      expectedVersion: 0,
      payload: { root: dir }
    };
    const initialRes = await fixture.service.registerProject(initialCmd);
    expect(initialRes.ok).toBe(true);
    if (!initialRes.ok) return;
    expect(initialRes.value.version).toBe(1);

    // 3. Stale update with expectedVersion: 0 (current is 1) should be rejected
    const staleCmd: Command<RegistrationInput> = {
      requestId: 'req-v2',
      idempotencyKey: 'key-v2',
      expectedVersion: 0,
      payload: { root: dir, remote: 'https://stale-remote.com' }
    };
    const staleRes = await fixture.service.registerProject(staleCmd);
    expect(staleRes.ok).toBe(false);
    if (!staleRes.ok) {
      expect(staleRes.error.code).toBe('VERSION_CONFLICT');
    }

    // 4. Verify state did NOT change
    const currentProj = fixture.service.listProjects()[0];
    expect(currentProj.version).toBe(1);
    expect(currentProj.remote).toBeUndefined();
  });

  it('receipt_and_event_persist_across_restart', async () => {
    const dir = path.join(fixture.allowedRoot, 'restart-proj');
    fs.mkdirSync(dir, { recursive: true });

    const cmd: Command<RegistrationInput> = {
      requestId: 'req-persist-1',
      idempotencyKey: 'persist-key-1',
      payload: { root: dir }
    };

    const res = await fixture.service.registerProject(cmd);
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    // Close and restart
    fixture.store.close();
    const reopenedStore = openStore(fixture.dbPath);
    const reopenedService = new ProjectService({
      store: reopenedStore,
      clock: fixture.clock,
      policy: fixture.policy
    });

    // Query raw tables across restart
    const receipts = reopenedStore.connection.prepare('SELECT * FROM processed_commands WHERE idempotency_key = ?').all('persist-key-1');
    expect(receipts).toHaveLength(1);

    const events = reopenedStore.connection.prepare('SELECT * FROM events').all();
    expect(events).toHaveLength(1);

    // Replay command on reopened service should return cached result without extra events
    const replayRes = await reopenedService.registerProject(cmd);
    expect(replayRes.ok).toBe(true);
    if (replayRes.ok) {
      expect(replayRes.value).toEqual(res.value);
    }

    const eventsAfterReplay = reopenedStore.connection.prepare('SELECT * FROM events').all();
    expect(eventsAfterReplay).toHaveLength(1);

    reopenedStore.close();
  });

  it('event_is_not_published_if_transaction_fails', async () => {
    const dir = path.join(fixture.allowedRoot, 'failing-proj');
    fs.mkdirSync(dir, { recursive: true });

    const publishedEvents: unknown[] = [];
    const eventStore = new EventStore();
    eventStore.subscribe(e => publishedEvents.push(e));

    const failingService = new ProjectService({
      store: fixture.store,
      clock: fixture.clock,
      policy: fixture.policy,
      eventStore,
      forceEventError: true
    });

    const cmd: Command<RegistrationInput> = {
      requestId: 'req-fail',
      idempotencyKey: 'key-fail',
      payload: { root: dir }
    };

    const res = await failingService.registerProject(cmd);
    expect(res.ok).toBe(false);

    // In-memory listener must NOT have received any event
    expect(publishedEvents).toHaveLength(0);

    // Event table in SQLite must also be empty
    const rawEvents = fixture.store.connection.prepare('SELECT * FROM events').all();
    expect(rawEvents).toHaveLength(0);
  });
});
