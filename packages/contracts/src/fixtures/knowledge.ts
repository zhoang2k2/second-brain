import {
  Note,
  NoteRevision,
  IngestNotePayload,
  PromoteCandidatePayload,
  RejectCandidatePayload,
  ReviewInput,
  CandidateView,
  RevisionView,
  NoteView,
  KnowledgePage,
  KnowledgeQuery,
  RetrievalHit,
  ShareInput
} from '../knowledge';

export const FIXTURE_HASH_ACTIVE = 'a1b2c3d4e5f60718293a4b5c6d7e8f90123456789abcdef0123456789abcdef0';
export const FIXTURE_HASH_PENDING = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

export const validNoteFixture: Note = {
  id: 'note-001',
  title: 'Architecture Overview',
  path: 'notes/architecture.md',
  currentRevisionId: 'rev-001',
  scope: { kind: 'global' },
  updatedAt: '2026-10-10T10:00:00Z'
};

export const validNoteRevisionFixture: NoteRevision = {
  noteId: 'note-001',
  revisionId: 'rev-001',
  content: '# Architecture Overview\nImmutable revisions and review workflow.',
  hash: FIXTURE_HASH_ACTIVE,
  state: 'active',
  status: 'approved',
  createdAt: '2026-10-10T09:00:00Z',
  approvedAt: '2026-10-10T10:00:00Z'
};

export const validIngestNotePayloadFixture: IngestNotePayload = {
  noteId: 'note-001',
  title: 'Architecture Overview',
  path: 'notes/architecture.md',
  content: '# Architecture Overview\nNew manual edits awaiting review.',
  scope: { kind: 'global' }
};

export const validPromoteCandidatePayloadFixture: PromoteCandidatePayload = {
  noteId: 'note-001',
  revisionId: 'rev-002',
  expectedHash: FIXTURE_HASH_PENDING
};

export const validRejectCandidatePayloadFixture: RejectCandidatePayload = {
  noteId: 'note-001',
  revisionId: 'rev-002'
};

export const validReviewInputFixture: ReviewInput = {
  candidateId: 'cand-001',
  candidateVersion: 1,
  expectedSourceHash: FIXTURE_HASH_PENDING
};

export const activeHit: RetrievalHit = {
  noteId: 'note-001',
  revisionId: 'rev-001',
  excerpt: 'Architecture Overview - Immutable revisions and review workflow.',
  scope: { kind: 'global' },
  sourcePath: 'notes/architecture.md',
  contentHash: FIXTURE_HASH_ACTIVE
};

export const pendingReplacement: CandidateView = {
  id: 'cand-002',
  revisionId: 'rev-002',
  version: 2,
  expectedSourceHash: FIXTURE_HASH_PENDING,
  state: 'pending',
  processing: 'ready',
  proposedLinks: [
    {
      sourceNoteId: 'note-001',
      targetNoteId: 'note-002',
      label: 'relates-to'
    }
  ]
};

export const validCandidateViewFixture: CandidateView = pendingReplacement;

export const validRevisionViewFixture: RevisionView = {
  id: 'rev-001',
  noteId: 'note-001',
  contentHash: FIXTURE_HASH_ACTIVE,
  markdown: '# Architecture Overview\nImmutable revisions and review workflow.',
  origin: 'vault-import',
  parentRevisionId: undefined
};

export const validNoteViewFixture: NoteView = {
  id: 'note-001',
  path: 'notes/architecture.md',
  scope: { kind: 'global' },
  version: 1,
  availability: 'available',
  activeRevisionId: 'rev-001',
  sharedWithProjectIds: []
};

export const validKnowledgePageFixture: KnowledgePage = {
  items: [validNoteViewFixture, pendingReplacement],
  total: 2
};

export const validKnowledgeQueryFixture: KnowledgeQuery = {
  scope: { kind: 'global' },
  text: 'architecture',
  column: 'active',
  limit: 20
};

export const validRetrievalHitFixture: RetrievalHit = activeHit;

export const validShareInputFixture: ShareInput = {
  noteId: 'note-001',
  expectedVersion: 1,
  expectedActiveHash: FIXTURE_HASH_ACTIVE,
  projectIds: ['proj-target']
};

export const knowledgeFixtures = {
  validNote: validNoteFixture,
  validRevision: validNoteRevisionFixture,
  validIngestPayload: validIngestNotePayloadFixture,
  validPromotePayload: validPromoteCandidatePayloadFixture,
  validRejectPayload: validRejectCandidatePayloadFixture,
  validReviewInput: validReviewInputFixture,
  activeHit,
  pendingReplacement,
  validCandidateView: validCandidateViewFixture,
  validRevisionView: validRevisionViewFixture,
  validNoteView: validNoteViewFixture,
  validKnowledgePage: validKnowledgePageFixture,
  validKnowledgeQuery: validKnowledgeQueryFixture,
  validRetrievalHit: validRetrievalHitFixture,
  validShareInput: validShareInputFixture
};
