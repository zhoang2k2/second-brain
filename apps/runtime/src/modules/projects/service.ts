import * as crypto from 'node:crypto';
import {
  Project,
  Vault,
  RegistrationInput,
  RegistrationInputSchema,
  Result,
  Instant,
  Command,
  RuntimeEvent
} from '@zhon/contracts';
import { Store } from '../../storage/database';
import { RegisteredRootPolicy } from '../../adapters/filesystem/registered-paths';
import { ProjectRepository } from './repository';
import { EventStore } from '../../server/events';

function hashPayload(payload: unknown): string {
  const canonicalJson = (value: unknown): string => {
    if (value === null || typeof value !== 'object') {
      return JSON.stringify(value);
    }
    if (Array.isArray(value)) {
      return '[' + value.map(canonicalJson).join(',') + ']';
    }
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj).sort();
    return '{' + keys.map(k => `${JSON.stringify(k)}:${canonicalJson(obj[k])}`).join(',') + '}';
  };

  return crypto.createHash('sha256').update(canonicalJson(payload)).digest('hex');
}

function normalizeCommand<T>(input: Command<T> | T): Command<T> {
  if (
    typeof input === 'object' &&
    input !== null &&
    'payload' in input &&
    'idempotencyKey' in input
  ) {
    const cmd = input as Command<T>;
    return {
      requestId: cmd.requestId ?? `req-${crypto.randomUUID()}`,
      idempotencyKey: cmd.idempotencyKey,
      expectedVersion: cmd.expectedVersion,
      payload: cmd.payload
    };
  }
  return {
    requestId: `req-${crypto.randomUUID()}`,
    idempotencyKey: `idem-${crypto.randomUUID()}`,
    payload: input as T
  };
}

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

  async registerProject(cmd: Command<RegistrationInput>): Promise<Result<Project>>;
  async registerProject(input: RegistrationInput): Promise<Result<Project>>;
  async registerProject(inputOrCmd: Command<RegistrationInput> | RegistrationInput): Promise<Result<Project>> {
    const command = normalizeCommand(inputOrCmd);
    const payload = command.payload;

    // 1. Validate contract schema of payload
    const parsed = RegistrationInputSchema.safeParse(payload);
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
    const pathResult = this.policy.validate(payload.root);
    if (!pathResult.ok) {
      return {
        ok: false,
        error: pathResult.error
      };
    }
    const canonicalRoot = pathResult.value;
    const payloadHash = hashPayload(payload);

    try {
      type TxResult =
        | { kind: 'cached'; result: Result<Project> }
        | { kind: 'conflict'; error: { code: string; message: string; retryable: boolean } }
        | { kind: 'success'; result: Result<Project>; event: RuntimeEvent<Project> };

      const txOutcome = this.store.transaction((): TxResult => {
        // Idempotency check:
        const existingReceipt = this.repository.findProcessedCommand(this.store.connection, command.idempotencyKey);
        if (existingReceipt) {
          if (existingReceipt.payloadHash === payloadHash) {
            return { kind: 'cached', result: JSON.parse(existingReceipt.result) as Result<Project> };
          }
          return {
            kind: 'conflict',
            error: {
              code: 'IDEMPOTENCY_CONFLICT',
              message: `Idempotency key '${command.idempotencyKey}' was reused with a different payload`,
              retryable: false
            }
          };
        }

        // Expected version check:
        const existing = this.repository.findProjectByRoot(this.store.connection, canonicalRoot);
        if (existing) {
          if (command.expectedVersion !== undefined && existing.version !== command.expectedVersion) {
            return {
              kind: 'conflict',
              error: {
                code: 'VERSION_CONFLICT',
                message: `Version conflict: existing version is ${existing.version}, expected ${command.expectedVersion}`,
                retryable: false
              }
            };
          }
        } else {
          if (command.expectedVersion !== undefined && command.expectedVersion !== 0) {
            return {
              kind: 'conflict',
              error: {
                code: 'VERSION_CONFLICT',
                message: `Version conflict: project does not exist, expected version was ${command.expectedVersion}`,
                retryable: false
              }
            };
          }
        }

        // Mutate resource state
        const proj: Project = existing
          ? {
              ...existing,
              remote: payload.remote ?? existing.remote,
              version: existing.version + 1
            }
          : {
              id: `proj-${crypto.randomUUID()}`,
              root: canonicalRoot,
              remote: payload.remote,
              version: 1,
              createdAt: this.clock()
            };

        this.repository.saveProject(this.store.connection, proj);

        if (this.forceEventError) {
          throw new Error('Simulated event persistence error');
        }

        // Append RuntimeEvent to event store
        const event = this.eventStore.appendEvent(this.store.connection, {
          type: 'project.registered',
          resourceId: proj.id,
          occurredAt: this.clock(),
          payload: proj
        });

        const successResult: Result<Project> = { ok: true, value: proj };

        // Save processed_command receipt
        this.repository.saveProcessedCommand(this.store.connection, {
          idempotencyKey: command.idempotencyKey,
          requestId: command.requestId,
          commandName: 'registerProject',
          payloadHash,
          result: JSON.stringify(successResult),
          createdAt: this.clock()
        });

        return { kind: 'success', result: successResult, event };
      });

      if (txOutcome.kind === 'conflict') {
        return { ok: false, error: txOutcome.error };
      }

      if (txOutcome.kind === 'cached') {
        return txOutcome.result;
      }

      // Publish event to in-memory listeners ONLY AFTER transaction commits successfully
      this.eventStore.publish(txOutcome.event);

      return txOutcome.result;
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

  async registerVault(cmd: Command<RegistrationInput>): Promise<Result<Vault>>;
  async registerVault(input: RegistrationInput): Promise<Result<Vault>>;
  async registerVault(inputOrCmd: Command<RegistrationInput> | RegistrationInput): Promise<Result<Vault>> {
    const command = normalizeCommand(inputOrCmd);
    const payload = command.payload;

    // 1. Validate contract schema
    const parsed = RegistrationInputSchema.safeParse(payload);
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
    const pathResult = this.policy.validate(payload.root);
    if (!pathResult.ok) {
      return {
        ok: false,
        error: pathResult.error
      };
    }
    const canonicalRoot = pathResult.value;
    const payloadHash = hashPayload(payload);

    try {
      type TxResult =
        | { kind: 'cached'; result: Result<Vault> }
        | { kind: 'conflict'; error: { code: string; message: string; retryable: boolean } }
        | { kind: 'success'; result: Result<Vault>; event: RuntimeEvent<Vault> };

      const txOutcome = this.store.transaction((): TxResult => {
        // Idempotency check:
        const existingReceipt = this.repository.findProcessedCommand(this.store.connection, command.idempotencyKey);
        if (existingReceipt) {
          if (existingReceipt.payloadHash === payloadHash) {
            return { kind: 'cached', result: JSON.parse(existingReceipt.result) as Result<Vault> };
          }
          return {
            kind: 'conflict',
            error: {
              code: 'IDEMPOTENCY_CONFLICT',
              message: `Idempotency key '${command.idempotencyKey}' was reused with a different payload`,
              retryable: false
            }
          };
        }

        // Expected version check:
        const existing = this.repository.findVaultByRoot(this.store.connection, canonicalRoot);
        if (!existing && this.repository.listVaults(this.store.connection).length > 0) {
          return {
            kind: 'conflict',
            error: { code: 'VAULT_LIMIT', message: 'MVP supports one vault. Keep the registered vault; do not merge sources.', retryable: false },
          };
        }
        if (existing) {
          if (command.expectedVersion !== undefined && existing.version !== command.expectedVersion) {
            return {
              kind: 'conflict',
              error: {
                code: 'VERSION_CONFLICT',
                message: `Version conflict: existing version is ${existing.version}, expected ${command.expectedVersion}`,
                retryable: false
              }
            };
          }
        } else {
          if (command.expectedVersion !== undefined && command.expectedVersion !== 0) {
            return {
              kind: 'conflict',
              error: {
                code: 'VERSION_CONFLICT',
                message: `Version conflict: vault does not exist, expected version was ${command.expectedVersion}`,
                retryable: false
              }
            };
          }
        }

        // Mutate resource state
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

        const successResult: Result<Vault> = { ok: true, value: v };

        this.repository.saveProcessedCommand(this.store.connection, {
          idempotencyKey: command.idempotencyKey,
          requestId: command.requestId,
          commandName: 'registerVault',
          payloadHash,
          result: JSON.stringify(successResult),
          createdAt: this.clock()
        });

        return { kind: 'success', result: successResult, event };
      });

      if (txOutcome.kind === 'conflict') {
        return { ok: false, error: txOutcome.error };
      }

      if (txOutcome.kind === 'cached') {
        return txOutcome.result;
      }

      // Publish event to in-memory listeners ONLY AFTER transaction commits successfully
      this.eventStore.publish(txOutcome.event);

      return txOutcome.result;
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
