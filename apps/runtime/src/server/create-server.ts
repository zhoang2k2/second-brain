import * as path from 'node:path';
import * as os from 'node:os';
import fastify, { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { Instant, Health } from '@zhon/contracts';
import { Store } from '../storage/database';
import { RegisteredRootPolicy } from '../adapters/filesystem/registered-paths';
import { LocalSessionConfig, LocalSessionManager } from './local-session';
import { EventStore } from './events';
import { ProjectService } from '../modules/projects/service';
import { projectRoutes } from '../modules/projects/routes';
import { RevisionStore } from '../modules/knowledge/revision-store';
import { KnowledgeRepository } from '../modules/knowledge/repository';
import { KnowledgeReviewService } from '../modules/knowledge/review';
import { KnowledgeRetrievalService } from '../modules/knowledge/retrieval';
import { KnowledgeIngestionService } from '../modules/knowledge/ingestion';
import { reconcilePromotions } from '../modules/knowledge/promotion';
import { VaultWatcher } from '../adapters/filesystem/vault-watcher';
import { knowledgeRoutes } from '../modules/knowledge/routes';

export interface ServerDeps {
  store: Store;
  clock: () => Instant;
  registeredRootPolicy: RegisteredRootPolicy;
  localSessionConfig: LocalSessionConfig;
  sessionManager?: LocalSessionManager;
  eventStore?: EventStore;
  revisionsDir?: string;
  knowledgeRepo?: KnowledgeRepository;
  reviewService?: KnowledgeReviewService;
  retrievalService?: KnowledgeRetrievalService;
  ingestionService?: KnowledgeIngestionService;
}

export async function createServer(deps: ServerDeps): Promise<FastifyInstance> {
  const registeredVaults = deps.store.connection.prepare('SELECT id, root FROM vaults').all() as Array<{ id: string; root: string }>;
  if (registeredVaults.length > 1) throw new Error('MVP cannot start with multiple vaults; preserve data and explicitly select one vault before proceeding.');
  const app = fastify({
    bodyLimit: 1048576, // Cap request bodies at 1 MiB
    logger: false
  });

  const sessionManager = deps.sessionManager ?? new LocalSessionManager(deps.localSessionConfig);
  (app as unknown as { sessionManager: LocalSessionManager }).sessionManager = sessionManager;
  const eventStore = deps.eventStore ?? new EventStore();
  const projectService = new ProjectService({
    store: deps.store,
    clock: deps.clock,
    policy: deps.registeredRootPolicy,
    eventStore
  });

  // Strict Host, Origin, and Session validation hook
  app.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    // 1. Host header validation: strictly restrict to loopback
    const host = request.headers.host;
    if (host) {
      const hostname = host.split(':')[0];
      if (hostname !== '127.0.0.1' && hostname !== 'localhost') {
        return reply.status(403).send({
          ok: false,
          error: {
            code: 'FORBIDDEN_HOST',
            message: `Forbidden host: ${host}`,
            retryable: false
          }
        });
      }
    }

    // 2. Strict origin validation hook: Reject foreign or untrusted origins
    const origin = request.headers.origin;
    if (origin) {
      if (origin === 'null' || !sessionManager.validateOrigin(origin)) {
        return reply.status(403).send({
          ok: false,
          error: {
            code: 'FORBIDDEN_ORIGIN',
            message: `Forbidden origin: ${origin}`,
            retryable: false
          }
        });
      }
    }

    // 3. Mutation session validation for /v1/commands/* and mutation endpoints
    const isMutation =
      request.method === 'POST' &&
      (request.url.startsWith('/v1/commands') ||
        request.url.startsWith('/v1/register') ||
        request.url.startsWith('/v1/approve') ||
        request.url.startsWith('/v1/reject') ||
        request.url.startsWith('/v1/deactivate') ||
        request.url.startsWith('/v1/rollback') ||
        request.url.startsWith('/v1/share') ||
        request.url.startsWith('/v1/capture') || request.url.startsWith('/v1/rescan'));
    if (isMutation) {
      const sessionId = (request.headers['x-session-id'] as string) ||
                        (request.headers.authorization?.startsWith('Bearer ') ? request.headers.authorization.slice(7) : undefined);
      if (!sessionId) {
        if (deps.localSessionConfig.requireSession !== false) {
          return reply.status(401).send({
            ok: false,
            error: {
              code: 'UNAUTHORIZED_SESSION',
              message: 'Session token required for mutations',
              retryable: false
            }
          });
        }
      } else {
        if (!sessionManager.validateSession(sessionId, request.headers.authorization?.startsWith('Bearer ') ? 'cli' : 'browser')) {
          return reply.status(401).send({
            ok: false,
            error: {
              code: 'UNAUTHORIZED_SESSION',
              message: 'Invalid or expired local session',
              retryable: false
            }
          });
        }
      }
    }
  });

  // GET /v1/health
  app.get('/v1/health', async (_request: FastifyRequest, reply: FastifyReply) => {
    let dbStatus: 'PASS' | 'FAIL' = 'PASS';
    try {
      deps.store.connection.prepare('SELECT 1').get();
    } catch {
      dbStatus = 'FAIL';
    }

    const health: Health = {
      ready: dbStatus === 'PASS',
      checks: [
        { name: 'database', status: dbStatus },
        { name: 'storage', status: 'PASS' }
      ]
    };
    return reply.send(health);
  });

  // Local session bootstrap
  app.post(
    '/v1/session/bootstrap',
    async (
      request: FastifyRequest<{ Body: { bootstrapCode: string; origin?: string } }>,
      reply: FastifyReply
    ) => {
      const body = request.body;
      const origin = request.headers.origin;
      const result = sessionManager.createLocalSession({
        bootstrapCode: body?.bootstrapCode,
        origin: body?.origin ?? origin
      });
      if (!result.ok) {
        return reply.status(403).send(result);
      }
      return reply.send(result);
    }
  );

  // Active SSE replies tracked for clean server shutdown
  const activeSseReplies = new Set<FastifyReply>();

  // GET /v1/events (SSE streaming)
  app.get(
    '/v1/events',
    async (
      request: FastifyRequest<{ Querystring: { after?: string } }>,
      reply: FastifyReply
    ) => {
      reply.hijack();
      activeSseReplies.add(reply);

      const query = request.query;
      const lastEventId = request.headers['last-event-id'];
      const rawAfter = query?.after ?? (typeof lastEventId === 'string' ? lastEventId : undefined);
      const parsedAfter = rawAfter ? parseInt(rawAfter, 10) : 0;
      const afterSequence = Number.isNaN(parsedAfter) ? 0 : parsedAfter;

      const origin = request.headers.origin;
      if (origin && sessionManager.validateOrigin(origin)) {
        reply.raw.setHeader('Access-Control-Allow-Origin', origin);
        reply.raw.setHeader('Access-Control-Allow-Credentials', 'true');
      }

      reply.raw.setHeader('Content-Type', 'text/event-stream');
      reply.raw.setHeader('Cache-Control', 'no-cache');
      reply.raw.setHeader('Connection', 'keep-alive');
      if (typeof reply.raw.flushHeaders === 'function') {
        reply.raw.flushHeaders();
      }

      const formatEvent = (evt: { sequence: number; type: string; [key: string]: unknown }) => {
        const type = evt.type || 'message';
        return `id: ${evt.sequence}\nevent: ${type}\ndata: ${JSON.stringify(evt)}\n\n`;
      };

      // Send existing historical events after sequence
      const existingEvents = eventStore.getEvents(deps.store.connection, afterSequence);
      for (const evt of existingEvents) {
        if (!reply.raw.destroyed && !reply.raw.writableEnded) {
          reply.raw.write(formatEvent(evt));
        }
      }

      // Subscribe to new real-time events
      const unsubscribe = eventStore.subscribe(evt => {
        if (!reply.raw.destroyed && !reply.raw.writableEnded) {
          reply.raw.write(formatEvent(evt));
        }
      });

      const cleanup = () => {
        activeSseReplies.delete(reply);
        unsubscribe();
      };

      request.raw.on('close', cleanup);
      reply.raw.on('close', cleanup);
    }
  );

  // Register projects routes
  await app.register(projectRoutes, { service: projectService });

  // Knowledge services and routes
  const knowledgeRepo = deps.knowledgeRepo ?? new KnowledgeRepository();

  const revisionsDir =
    deps.revisionsDir ??
    (deps.store.connection.name && deps.store.connection.name !== ':memory:'
      ? path.join(path.dirname(deps.store.connection.name), 'revisions')
      : path.join(os.tmpdir(), 'zhon-revisions'));
  const revisionStore = new RevisionStore({ revisionsDir });
  await reconcilePromotions(deps.store, knowledgeRepo, deps.clock, revisionStore);
  const reviewService =
    deps.reviewService ??
    new KnowledgeReviewService({
      store: deps.store,
      repo: knowledgeRepo,
      revisionStore,
      clock: deps.clock,
      eventStore
    });
  const retrievalService =
    deps.retrievalService ??
    new KnowledgeRetrievalService({
      store: deps.store,
      repo: knowledgeRepo,
      clock: deps.clock
    });
  const ingestionService =
    deps.ingestionService ??
    new KnowledgeIngestionService({
      store: deps.store,
      repo: knowledgeRepo,
      revisionStore,
      policy: deps.registeredRootPolicy,
      clock: deps.clock
    });

  await app.register(knowledgeRoutes, { reviewService, retrievalService, ingestionService });

  // Background filesystem watchers for registered vaults
  const watchers = new Map<string, VaultWatcher>();
  const backgroundJobs = new Set<Promise<unknown>>();
  let closing = false;
  const trackJob = <T>(job: Promise<T>): Promise<T> => {
    backgroundJobs.add(job);
    void job.finally(() => backgroundJobs.delete(job)).catch(() => {});
    return job;
  };

  const startWatcherForVault = (vaultRoot: string, vaultId: string): VaultWatcher | undefined => {
    if (watchers.has(vaultId)) {
      return watchers.get(vaultId);
    }
    try {
      const watcher = new VaultWatcher({
        vaultRoot,
        debounceMs: 150,
        onChange: async (relPath) => {
          if (closing) return;
          try {
            const captureRes = await trackJob(ingestionService.captureNote({
              vaultId,
              path: relPath
            }));
            if (closing) return;
            if (!captureRes.ok) {
              eventStore.recordEvent(deps.store.connection, {
                type: 'knowledge.note_updated', resourceId: vaultId, occurredAt: deps.clock(),
                payload: { vaultId, path: relPath, issue: { code: captureRes.error.code, retryable: captureRes.error.retryable } },
              });
              return;
            }
            if (captureRes.ok && captureRes.value.candidate.state === 'pending') {
              const candidate = captureRes.value.candidate;
              eventStore.recordEvent(deps.store.connection, {
                type: 'knowledge.candidate_created',
                resourceId: candidate.id,
                occurredAt: deps.clock(),
                data: {
                  vaultId,
                  path: relPath,
                  candidate
                },
                payload: {
                  vaultId,
                  path: relPath,
                  candidate
                }
              });
            }
          } catch {
            // Ignore background watcher processing errors
          }
        }
      });
      watcher.start();
      watchers.set(vaultId, watcher);
      return watcher;
    } catch {
      return undefined;
    }
  };

  interface ServerWithWatchers {
    attachVaultWatcher: (vaultId: string, vaultRoot: string) => VaultWatcher | undefined;
    getVaultWatchers: () => Map<string, VaultWatcher>;
    ingestionService: KnowledgeIngestionService;
  }
  const appExt = app as unknown as ServerWithWatchers;
  appExt.attachVaultWatcher = (vaultId: string, vaultRoot: string) => startWatcherForVault(vaultRoot, vaultId);
  appExt.getVaultWatchers = () => watchers;
  appExt.ingestionService = ingestionService;

  // On server startup: query all registered vaults from database
  try {
    const vaults = deps.store.connection
      .prepare('SELECT id, root FROM vaults')
      .all() as Array<{ id: string; root: string }>;
    for (const v of vaults) {
      startWatcherForVault(v.root, v.id);
      await ingestionService.rescanVault(v.id);
    }
  } catch {
    // Ignore error listing vaults
  }

  // Auto-attach when vault is registered via eventStore
  const unsubscribeVaultRegistration = eventStore.subscribe((evt) => {
    if (evt.type === 'vault.registered' && evt.payload && typeof evt.payload === 'object') {
      const v = evt.payload as { root: string; id: string };
      if (v.root && v.id) {
        startWatcherForVault(v.root, v.id);
        void trackJob(ingestionService.rescanVault(v.id)).then(result => {
          if (!closing) eventStore.recordEvent(deps.store.connection, {
            type: 'knowledge.scan_completed', resourceId: v.id, occurredAt: deps.clock(), payload: result,
          });
        }).catch(() => {});
      }
    }
  });

  // On server close: close all active vault watchers and SSE streams
  app.addHook('onClose', async () => {
    closing = true;
    unsubscribeVaultRegistration();
    for (const watcher of watchers.values()) watcher.close();
    await Promise.allSettled([...backgroundJobs]);
    for (const sseReply of activeSseReplies) {
      try {
        if (!sseReply.raw.destroyed && !sseReply.raw.writableEnded) {
          sseReply.raw.end();
          sseReply.raw.destroy();
        }
      } catch {
        // Ignore socket destroy errors
      }
    }
    activeSseReplies.clear();

    for (const w of watchers.values()) {
      w.close();
    }
    watchers.clear();
  });

  return app;
}
