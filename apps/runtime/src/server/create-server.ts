import fastify, { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { Instant, Health } from '@zhon/contracts';
import { Store } from '../storage/database';
import { RegisteredRootPolicy } from '../adapters/filesystem/registered-paths';
import { LocalSessionConfig, LocalSessionManager } from './local-session';
import { EventStore } from './events';
import { ProjectService } from '../modules/projects/service';
import { projectRoutes } from '../modules/projects/routes';

export interface ServerDeps {
  store: Store;
  clock: () => Instant;
  registeredRootPolicy: RegisteredRootPolicy;
  localSessionConfig: LocalSessionConfig;
  sessionManager?: LocalSessionManager;
  eventStore?: EventStore;
}

export async function createServer(deps: ServerDeps): Promise<FastifyInstance> {
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

    // 3. Mutation session validation for /v1/commands/*
    const isMutation = request.method === 'POST' && (request.url.startsWith('/v1/commands') || request.url.startsWith('/v1/register'));
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

  // GET /v1/events (SSE streaming)
  app.get(
    '/v1/events',
    async (
      request: FastifyRequest<{ Querystring: { after?: string } }>,
      reply: FastifyReply
    ) => {
      reply.hijack();

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
        unsubscribe();
      };

      request.raw.on('close', cleanup);
      reply.raw.on('close', cleanup);
    }
  );

  // Register projects routes
  await app.register(projectRoutes, { service: projectService });

  return app;
}
