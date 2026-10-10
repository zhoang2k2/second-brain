import * as crypto from 'node:crypto';
import {
  Project,
  Vault,
  RegistrationInput,
  RegistrationInputSchema,
  Result,
  Instant
} from '@zhon/contracts';
import { Store } from '../../storage/database';
import { RegisteredRootPolicy } from '../../adapters/filesystem/registered-paths';
import { ProjectRepository } from './repository';
import { EventStore } from '../../server/events';

export interface ProjectServiceDeps {
  store: Store;
  clock: () => Instant;
  policy: RegisteredRootPolicy;
  eventStore?: EventStore;
  repository?: ProjectRepository;
  forceEventError?: boolean;
}

export class ProjectService {
  private store: Store;
  private clock: () => Instant;
  private policy: RegisteredRootPolicy;
  private eventStore: EventStore;
  private repository: ProjectRepository;
  private forceEventError: boolean;

  constructor(deps: ProjectServiceDeps) {
    this.store = deps.store;
    this.clock = deps.clock;
    this.policy = deps.policy;
    this.eventStore = deps.eventStore ?? new EventStore();
    this.repository = deps.repository ?? new ProjectRepository();
    this.forceEventError = deps.forceEventError ?? false;
  }

  async registerProject(input: RegistrationInput): Promise<Result<Project>> {
    // 1. Validate contract schema
    const parsed = RegistrationInputSchema.safeParse(input);
    if (!parsed.success) {
      return {
        ok: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: parsed.error.issues.map(i => i.message).join(', '),
          retryable: false
        }
      };
    }

    // 2. Validate canonical path and check scope
    const pathResult = this.policy.validate(input.root);
    if (!pathResult.ok) {
      return {
        ok: false,
        error: pathResult.error
      };
    }
    const canonicalRoot = pathResult.value;

    try {
      // 3. Atomically persist project state and event in one SQLite transaction
      const project = this.store.transaction(() => {
        const existing = this.repository.findProjectByRoot(this.store.connection, canonicalRoot);
        const proj: Project = existing
          ? {
              ...existing,
              remote: input.remote ?? existing.remote,
              version: existing.version + 1
            }
          : {
              id: `proj-${crypto.randomUUID()}`,
              root: canonicalRoot,
              remote: input.remote,
              version: 1,
              createdAt: this.clock()
            };

        this.repository.saveProject(this.store.connection, proj);

        if (this.forceEventError) {
          throw new Error('Simulated event persistence error');
        }

        const event = this.eventStore.appendEvent(this.store.connection, {
          type: 'project.registered',
          resourceId: proj.id,
          occurredAt: this.clock(),
          payload: proj
        });

        // Publish to in-memory listeners
        this.eventStore.publish(event);

        return proj;
      });

      return { ok: true, value: project };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        ok: false,
        error: {
          code: 'TRANSACTION_FAILED',
          message: msg || 'Failed to persist project registration',
          retryable: false
        }
      };
    }
  }

  async registerVault(input: RegistrationInput): Promise<Result<Vault>> {
    // 1. Validate contract schema
    const parsed = RegistrationInputSchema.safeParse(input);
    if (!parsed.success) {
      return {
        ok: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: parsed.error.issues.map(i => i.message).join(', '),
          retryable: false
        }
      };
    }

    // 2. Validate canonical path and check scope
    const pathResult = this.policy.validate(input.root);
    if (!pathResult.ok) {
      return {
        ok: false,
        error: pathResult.error
      };
    }
    const canonicalRoot = pathResult.value;

    try {
      // 3. Atomically persist vault state and event
      const vault = this.store.transaction(() => {
        const existing = this.repository.findVaultByRoot(this.store.connection, canonicalRoot);
        const v: Vault = existing
          ? {
              ...existing,
              version: existing.version + 1
            }
          : {
              id: `vault-${crypto.randomUUID()}`,
              root: canonicalRoot,
              version: 1,
              createdAt: this.clock()
            };

        this.repository.saveVault(this.store.connection, v);

        if (this.forceEventError) {
          throw new Error('Simulated event persistence error');
        }

        const event = this.eventStore.appendEvent(this.store.connection, {
          type: 'vault.registered',
          resourceId: v.id,
          occurredAt: this.clock(),
          payload: v
        });

        this.eventStore.publish(event);

        return v;
      });

      return { ok: true, value: vault };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        ok: false,
        error: {
          code: 'TRANSACTION_FAILED',
          message: msg || 'Failed to persist vault registration',
          retryable: false
        }
      };
    }
  }

  listProjects(): Project[] {
    return this.repository.listProjects(this.store.connection);
  }

  listVaults(): Vault[] {
    return this.repository.listVaults(this.store.connection);
  }
}
