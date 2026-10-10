import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { ProjectService } from './service';
import { openStore, Store } from '../../storage/database';
import { RegisteredRootPolicy } from '../../adapters/filesystem/registered-paths';
import { RegistrationInput, Project, Result } from '@zhon/contracts';

interface TestFixture {
  service: ProjectService;
  store: Store;
  tempDir: string;
  allowedRoot: string;
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
    tempDir,
    allowedRoot,
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
});
