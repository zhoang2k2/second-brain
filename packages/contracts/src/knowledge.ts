import { z } from 'zod';
import { IDSchema, InstantSchema, ScopeSchema } from './common';
export type { Scope, Instant, ID } from './common';

// Base Identifiers & Primitives
export const NoteIdSchema = IDSchema;
export type NoteId = z.infer<typeof NoteIdSchema>;

export const RevisionIdSchema = IDSchema;
export type RevisionId = z.infer<typeof RevisionIdSchema>;

export const RevisionHashSchema = z.string().regex(/^[a-f0-9]{64}$/i, {
  message: 'Revision hash must be a 64-character hexadecimal SHA-256 hash'
});
export type RevisionHash = z.infer<typeof RevisionHashSchema>;

// Revision State & Review Status
export const RevisionStateSchema = z.enum(['active', 'candidate', 'deactive']);
export type RevisionState = z.infer<typeof RevisionStateSchema>;

export const ReviewStatusSchema = z.enum(['unreviewed', 'approved', 'rejected']);
export type ReviewStatus = z.infer<typeof ReviewStatusSchema>;

// Note Revision
export const NoteRevisionSchema = z.object({
  noteId: NoteIdSchema,
  revisionId: RevisionIdSchema,
  content: z.string(),
  hash: RevisionHashSchema,
  state: RevisionStateSchema,
  status: ReviewStatusSchema,
  createdAt: InstantSchema,
  approvedAt: InstantSchema.optional()
}).strict();
export type NoteRevision = z.infer<typeof NoteRevisionSchema>;

// Note
export const NoteSchema = z.object({
  id: NoteIdSchema,
  title: z.string(),
  path: z.string(),
  currentRevisionId: RevisionIdSchema,
  scope: ScopeSchema,
  updatedAt: InstantSchema
}).strict();
export type Note = z.infer<typeof NoteSchema>;

// Payloads
export const IngestNotePayloadSchema = z.object({
  noteId: NoteIdSchema.optional(),
  title: z.string(),
  path: z.string(),
  content: z.string(),
  scope: ScopeSchema
}).strict();
export type IngestNotePayload = z.infer<typeof IngestNotePayloadSchema>;

export const PromoteCandidatePayloadSchema = z.object({
  noteId: NoteIdSchema,
  revisionId: RevisionIdSchema,
  expectedHash: RevisionHashSchema
}).strict();
export type PromoteCandidatePayload = z.infer<typeof PromoteCandidatePayloadSchema>;

export const RejectCandidatePayloadSchema = z.object({
  noteId: NoteIdSchema,
  revisionId: RevisionIdSchema
}).strict();
export type RejectCandidatePayload = z.infer<typeof RejectCandidatePayloadSchema>;

// Review & Views
export const ReviewInputSchema = z.object({
  candidateId: IDSchema,
  candidateVersion: z.number().int().positive(),
  expectedSourceHash: RevisionHashSchema
}).strict();
export type ReviewInput = z.infer<typeof ReviewInputSchema>;

export const NoteLinkSchema = z.object({
  sourceNoteId: IDSchema,
  targetNoteId: IDSchema,
  label: z.string()
}).strict();
export type NoteLink = z.infer<typeof NoteLinkSchema>;

export const CandidateStateSchema = z.enum(['pending', 'approved', 'rejected', 'stale']);
export type CandidateState = z.infer<typeof CandidateStateSchema>;

export const CandidateProcessingSchema = z.enum(['pending', 'ready', 'failed', 'budgetBlocked']);
export type CandidateProcessing = z.infer<typeof CandidateProcessingSchema>;

export const CandidateViewSchema = z.object({
  id: IDSchema,
  revisionId: IDSchema,
  version: z.number(),
  expectedSourceHash: RevisionHashSchema,
  state: CandidateStateSchema,
  processing: CandidateProcessingSchema,
  proposedLinks: z.array(NoteLinkSchema),
  noteId: IDSchema.optional(),
  title: z.string().optional(),
  path: z.string().optional(),
  markdown: z.string().optional(),
  previousMarkdown: z.string().optional()
}).strict();
export type CandidateView = z.infer<typeof CandidateViewSchema>;

export const RevisionViewSchema = z.object({
  id: IDSchema,
  noteId: IDSchema,
  contentHash: RevisionHashSchema,
  markdown: z.string(),
  origin: z.string().optional(),
  parentRevisionId: IDSchema.optional()
}).strict();
export type RevisionView = z.infer<typeof RevisionViewSchema>;

export const NoteAvailabilitySchema = z.enum(['available', 'missing', 'unsafe']);
export type NoteAvailability = z.infer<typeof NoteAvailabilitySchema>;

export const NoteViewSchema = z.object({
  id: IDSchema,
  title: z.string().optional(),
  path: z.string(),
  scope: ScopeSchema,
  version: z.number(),
  availability: NoteAvailabilitySchema,
  activeRevisionId: IDSchema.optional(),
  markdown: z.string().optional(),
  contentHash: RevisionHashSchema.optional(),
  sharedWithProjectIds: z.array(IDSchema).default([])
}).strict();
export type NoteView = z.infer<typeof NoteViewSchema>;

export const KnowledgePageSchema = z.object({
  items: z.array(z.union([NoteViewSchema, CandidateViewSchema])),
  total: z.number()
}).strict();
export type KnowledgePage = z.infer<typeof KnowledgePageSchema>;

export const KnowledgeQueryColumnSchema = z.enum(['active', 'candidate', 'deactivated', 'history']);
export type KnowledgeQueryColumn = z.infer<typeof KnowledgeQueryColumnSchema>;

export const KnowledgeQuerySchema = z.object({
  scope: ScopeSchema,
  text: z.string().optional(),
  column: KnowledgeQueryColumnSchema,
  limit: z.number().int().min(1).max(100).optional()
}).strict();
export type KnowledgeQuery = z.infer<typeof KnowledgeQuerySchema>;

export const RetrievalHitSchema = z.object({
  noteId: IDSchema,
  revisionId: IDSchema,
  excerpt: z.string(),
  scope: ScopeSchema,
  sourcePath: z.string(),
  contentHash: RevisionHashSchema
}).strict();
export type RetrievalHit = z.infer<typeof RetrievalHitSchema>;

export const ShareInputSchema = z.object({
  noteId: IDSchema,
  expectedVersion: z.number().int().positive(),
  expectedActiveHash: RevisionHashSchema,
  projectIds: z.array(IDSchema)
}).strict();
export type ShareInput = z.infer<typeof ShareInputSchema>;
