import { FastifyInstance, FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import {
  ReviewInputSchema,
  ShareInputSchema,
  CommandSchema,
  KnowledgeQuerySchema,
  KnowledgeQueryColumnSchema,
  ScopeSchema
} from '@zhon/contracts';
import { z } from 'zod';
import { KnowledgeReviewService } from './review';
import { KnowledgeRetrievalService } from './retrieval';
import { KnowledgeIngestionService } from './ingestion';

export interface KnowledgeRoutesOptions {
  reviewService: KnowledgeReviewService;
  retrievalService: KnowledgeRetrievalService;
  ingestionService?: KnowledgeIngestionService;
}

const DeactivateNotePayloadSchema = z.object({
  noteId: z.string(),
  expectedVersion: z.number().int().positive()
}).strict();

const RollbackNotePayloadSchema = z.object({
  noteId: z.string(),
  revisionId: z.string(),
  expectedVersion: z.number().int().positive()
}).strict();

const CaptureNotePayloadSchema = z.object({
  vaultId: z.string(),
  path: z.string(),
  defaultScope: ScopeSchema.optional()
}).strict();

const RescanVaultPayloadSchema = z.object({
  vaultId: z.string()
}).strict();

export const knowledgeRoutes: FastifyPluginAsync<KnowledgeRoutesOptions> = async (
  fastify: FastifyInstance,
  options
) => {
  const { reviewService, retrievalService } = options;

  const invalidCommand = (reply: FastifyReply, message = 'Command envelope is invalid') =>
    reply.status(400).send({
      ok: false,
      error: { code: 'INVALID_COMMAND', message, retryable: false }
    });

  // GET /v1/knowledge
  fastify.get('/v1/knowledge', async (request: FastifyRequest, reply: FastifyReply) => {
    const q = request.query as Record<string, string | undefined>;

    let scope;
    if (q.scope) {
      try {
        scope = JSON.parse(q.scope);
      } catch {
        return reply.status(400).send({ ok: false, error: { code: 'INVALID_QUERY', message: 'Scope must be valid JSON.', retryable: false } });
      }
    } else if (q.scope_kind === 'project' && q.scope_project_id) {
      scope = { kind: 'project', projectId: q.scope_project_id };
    } else {
      scope = { kind: 'global' };
    }

    const columnParsed = KnowledgeQueryColumnSchema.safeParse(q.column ?? 'active');
    const column = columnParsed.success ? columnParsed.data : q.column;
    const limit = q.limit ? Number(q.limit) : undefined;

    const query = {
      scope,
      text: q.text,
      column,
      limit
    };

    const parsedQuery = KnowledgeQuerySchema.safeParse(query);
    if (!parsedQuery.success) {
      return reply.status(400).send({
        ok: false,
        error: { code: 'INVALID_QUERY', message: 'Query validation failed', retryable: false }
      });
    }

    const result = await retrievalService.searchKnowledge(parsedQuery.data);
    return reply.send(result);
  });

  // POST /v1/commands/approveCandidate
  const handleApproveCandidate = async (request: FastifyRequest, reply: FastifyReply) => {
    const cmd = CommandSchema(ReviewInputSchema).safeParse(request.body);
    if (!cmd.success) return invalidCommand(reply);
    const result = await reviewService.approveCandidate(cmd.data.payload, cmd.data);
    return reply.status(result.ok ? 200 : 400).send(result);
  };
  fastify.post('/v1/commands/approveCandidate', handleApproveCandidate);
  fastify.post('/v1/approveCandidate', handleApproveCandidate);

  // POST /v1/commands/rejectCandidate
  const handleRejectCandidate = async (request: FastifyRequest, reply: FastifyReply) => {
    const cmd = CommandSchema(ReviewInputSchema).safeParse(request.body);
    if (!cmd.success) return invalidCommand(reply);
    const result = await reviewService.rejectCandidate(cmd.data.payload, cmd.data);
    return reply.status(result.ok ? 200 : 400).send(result);
  };
  fastify.post('/v1/commands/rejectCandidate', handleRejectCandidate);
  fastify.post('/v1/rejectCandidate', handleRejectCandidate);

  // POST /v1/commands/deactivateNote
  const handleDeactivateNote = async (request: FastifyRequest, reply: FastifyReply) => {
    const cmd = CommandSchema(DeactivateNotePayloadSchema).safeParse(request.body);
    if (!cmd.success) return invalidCommand(reply);
    const result = await reviewService.deactivateNote(cmd.data.payload, cmd.data);
    return reply.status(result.ok ? 200 : 400).send(result);
  };
  fastify.post('/v1/commands/deactivateNote', handleDeactivateNote);
  fastify.post('/v1/deactivateNote', handleDeactivateNote);

  // POST /v1/commands/rollbackNote
  const handleRollbackNote = async (request: FastifyRequest, reply: FastifyReply) => {
    const cmd = CommandSchema(RollbackNotePayloadSchema).safeParse(request.body);
    if (!cmd.success) return invalidCommand(reply);
    const result = await reviewService.rollbackNote(cmd.data.payload, cmd.data);
    return reply.status(result.ok ? 200 : 400).send(result);
  };
  fastify.post('/v1/commands/rollbackNote', handleRollbackNote);
  fastify.post('/v1/rollbackNote', handleRollbackNote);

  // POST /v1/commands/shareNote
  const handleShareNote = async (request: FastifyRequest, reply: FastifyReply) => {
    const cmd = CommandSchema(ShareInputSchema).safeParse(request.body);
    if (!cmd.success) return invalidCommand(reply);
    const result = await reviewService.shareNote(cmd.data.payload, cmd.data);
    return reply.status(result.ok ? 200 : 400).send(result);
  };
  fastify.post('/v1/commands/shareNote', handleShareNote);
  fastify.post('/v1/shareNote', handleShareNote);

  // POST /v1/commands/captureNote
  const handleCaptureNote = async (request: FastifyRequest, reply: FastifyReply) => {
    if (!options.ingestionService) {
      return reply.status(501).send({
        ok: false,
        error: { code: 'NOT_IMPLEMENTED', message: 'Ingestion service not configured', retryable: false }
      });
    }
    const cmd = CommandSchema(CaptureNotePayloadSchema).safeParse(request.body);
    if (!cmd.success) return invalidCommand(reply);
    const result = await options.ingestionService.captureNote(cmd.data.payload);
    return reply.status(result.ok ? 200 : 400).send(result);
  };
  fastify.post('/v1/commands/captureNote', handleCaptureNote);
  fastify.post('/v1/captureNote', handleCaptureNote);

  // POST /v1/commands/rescanVault
  const handleRescanVault = async (request: FastifyRequest, reply: FastifyReply) => {
    if (!options.ingestionService) {
      return reply.status(501).send({
        ok: false,
        error: { code: 'NOT_IMPLEMENTED', message: 'Ingestion service not configured', retryable: false }
      });
    }
    const cmd = CommandSchema(RescanVaultPayloadSchema).safeParse(request.body);
    if (!cmd.success) return invalidCommand(reply);
    const result = await options.ingestionService.rescanVault(cmd.data.payload.vaultId);
    return reply.status(200).send({ ok: true, value: result });
  };
  fastify.post('/v1/commands/rescanVault', handleRescanVault);
  fastify.post('/v1/rescanVault', handleRescanVault);
};
