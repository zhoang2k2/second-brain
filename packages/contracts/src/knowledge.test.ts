import { describe, it, expect } from 'vitest';
import {
  NoteIdSchema,
  RevisionHashSchema,
  RevisionIdSchema,
  RevisionStateSchema,
  ReviewStatusSchema,
  NoteRevisionSchema,
  NoteSchema,
  IngestNotePayloadSchema,
  PromoteCandidatePayloadSchema,
  RejectCandidatePayloadSchema,
  ReviewInputSchema,
  NoteLinkSchema,
  CandidateViewSchema,
  RevisionViewSchema,
  NoteViewSchema,
  KnowledgePageSchema,
  KnowledgeQuerySchema,
  RetrievalHitSchema,
  ShareInputSchema,
  validNoteFixture,
  validNoteRevisionFixture,
  validIngestNotePayloadFixture,
  validPromoteCandidatePayloadFixture,
  validRejectCandidatePayloadFixture,
  activeHit,
  pendingReplacement,
  knowledgeFixtures
} from './index';

const VALID_HASH = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
const VALID_HASH_ALT = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

describe('knowledge contracts and schema validations', () => {
  it('review_requires_exact_version_and_hash', () => {
    // Focused assertion required by plan
    expect(ReviewInputSchema.safeParse({ candidateId: 'c1', candidateVersion: 1 }).success).toBe(false);

    // Missing candidateId
    expect(ReviewInputSchema.safeParse({ candidateVersion: 1, expectedSourceHash: VALID_HASH }).success).toBe(false);

    // Invalid candidateVersion type
    expect(ReviewInputSchema.safeParse({ candidateId: 'c1', candidateVersion: '1', expectedSourceHash: VALID_HASH }).success).toBe(false);

    // Malformed expectedSourceHash
    expect(ReviewInputSchema.safeParse({ candidateId: 'c1', candidateVersion: 1, expectedSourceHash: 'bad-hash' }).success).toBe(false);

    // Injected unknown fields rejected
    expect(ReviewInputSchema.safeParse({ candidateId: 'c1', candidateVersion: 1, expectedSourceHash: VALID_HASH, extraField: 'exploit' }).success).toBe(false);

    // Valid review input passes
    expect(ReviewInputSchema.safeParse({ candidateId: 'c1', candidateVersion: 1, expectedSourceHash: VALID_HASH }).success).toBe(true);
  });

  it('retrieval_scope_is_validated', () => {
    // Global scope retrieval hit
    const globalHit = {
      noteId: 'note-1',
      revisionId: 'rev-1',
      excerpt: 'Approved content excerpt',
      scope: { kind: 'global' },
      sourcePath: 'notes/architecture.md',
      contentHash: VALID_HASH
    };
    expect(RetrievalHitSchema.safeParse(globalHit).success).toBe(true);

    // Project scope retrieval hit
    const projectHit = {
      noteId: 'note-2',
      revisionId: 'rev-2',
      excerpt: 'Project specific note',
      scope: { kind: 'project', projectId: 'proj-1' },
      sourcePath: 'projects/proj-1/note.md',
      contentHash: VALID_HASH
    };
    expect(RetrievalHitSchema.safeParse(projectHit).success).toBe(true);

    // Invalid scope kind rejected
    expect(RetrievalHitSchema.safeParse({ ...globalHit, scope: { kind: 'vault' } }).success).toBe(false);

    // Missing projectId in project scope rejected
    expect(RetrievalHitSchema.safeParse({ ...globalHit, scope: { kind: 'project' } }).success).toBe(false);

    // Scope validated in KnowledgeQuery
    expect(KnowledgeQuerySchema.safeParse({ scope: { kind: 'global' }, column: 'active' }).success).toBe(true);
    expect(KnowledgeQuerySchema.safeParse({ scope: { kind: 'project', projectId: 'proj-1' }, column: 'candidate', limit: 10 }).success).toBe(true);
    expect(KnowledgeQuerySchema.safeParse({ scope: { kind: 'invalid' }, column: 'active' }).success).toBe(false);
    expect(KnowledgeQuerySchema.safeParse({ scope: { kind: 'global' }, column: 'unsupported' }).success).toBe(false);
  });

  it('import_does_not_trust_active_frontmatter', () => {
    // Valid ingest payload
    expect(IngestNotePayloadSchema.safeParse(validIngestNotePayloadFixture).success).toBe(true);

    // Injected active flag from frontmatter must be rejected
    const injectedActive = {
      ...validIngestNotePayloadFixture,
      active: true
    };
    expect(IngestNotePayloadSchema.safeParse(injectedActive).success).toBe(false);

    // Injected approved review status must be rejected
    const injectedStatus = {
      ...validIngestNotePayloadFixture,
      status: 'approved'
    };
    expect(IngestNotePayloadSchema.safeParse(injectedStatus).success).toBe(false);

    // Injected revision pointer must be rejected
    const injectedRevision = {
      ...validIngestNotePayloadFixture,
      currentRevisionId: 'rev-injected'
    };
    expect(IngestNotePayloadSchema.safeParse(injectedRevision).success).toBe(false);

    // Injected unapproved state must be rejected
    const injectedState = {
      ...validIngestNotePayloadFixture,
      state: 'active'
    };
    expect(IngestNotePayloadSchema.safeParse(injectedState).success).toBe(false);
  });

  it('fixtures_include_old_active_plus_pending_replacement', () => {
    // Focused assertion required by plan
    expect(pendingReplacement.revisionId).not.toBe(activeHit.revisionId);
    expect(knowledgeFixtures.pendingReplacement.revisionId).not.toBe(knowledgeFixtures.activeHit.revisionId);

    // Verify fixture schema validity
    expect(RetrievalHitSchema.safeParse(activeHit).success).toBe(true);
    expect(CandidateViewSchema.safeParse(pendingReplacement).success).toBe(true);
    expect(NoteSchema.safeParse(validNoteFixture).success).toBe(true);
    expect(NoteRevisionSchema.safeParse(validNoteRevisionFixture).success).toBe(true);
  });

  it('schemas_reject_unknown_fields_and_strictly_validate', () => {
    // NoteSchema rejects injected fields
    expect(NoteSchema.safeParse({ ...validNoteFixture, injectedFlag: true }).success).toBe(false);

    // NoteRevisionSchema rejects injected fields
    expect(NoteRevisionSchema.safeParse({ ...validNoteRevisionFixture, backdoor: 'admin' }).success).toBe(false);

    // PromoteCandidatePayloadSchema rejects injected fields
    expect(PromoteCandidatePayloadSchema.safeParse({ ...validPromoteCandidatePayloadFixture, skipValidation: true }).success).toBe(false);

    // RejectCandidatePayloadSchema rejects injected fields
    expect(RejectCandidatePayloadSchema.safeParse({ ...validRejectCandidatePayloadFixture, force: true }).success).toBe(false);

    // NoteViewSchema rejects injected fields
    const validNoteView = {
      id: 'note-1',
      path: 'notes/guide.md',
      scope: { kind: 'global' as const },
      version: 1,
      availability: 'available' as const,
      activeRevisionId: 'rev-1',
      sharedWithProjectIds: []
    };
    expect(NoteViewSchema.safeParse(validNoteView).success).toBe(true);
    expect(NoteViewSchema.safeParse({ ...validNoteView, extra: 123 }).success).toBe(false);

    // ShareInputSchema rejects injected fields
    const validShareInput = {
      noteId: 'note-1',
      expectedVersion: 1,
      expectedActiveHash: VALID_HASH,
      projectIds: ['proj-2']
    };
    expect(ShareInputSchema.safeParse(validShareInput).success).toBe(true);
    expect(ShareInputSchema.safeParse({ ...validShareInput, grantAll: true }).success).toBe(false);

    // NoteId and RevisionId validation
    expect(NoteIdSchema.safeParse('note-valid-id').success).toBe(true);
    expect(RevisionIdSchema.safeParse('rev-valid-id').success).toBe(true);

    // NoteLinkSchema validation
    const validLink = { sourceNoteId: 'n1', targetNoteId: 'n2', label: 'relates-to' };
    expect(NoteLinkSchema.safeParse(validLink).success).toBe(true);
    expect(NoteLinkSchema.safeParse({ ...validLink, unknownField: true }).success).toBe(false);

    // RevisionViewSchema validation
    const validRevView = {
      id: 'rev-1',
      noteId: 'note-1',
      contentHash: VALID_HASH,
      markdown: '# Content'
    };
    expect(RevisionViewSchema.safeParse(validRevView).success).toBe(true);
    expect(RevisionViewSchema.safeParse({ ...validRevView, unknownProp: 'bad' }).success).toBe(false);

    // KnowledgePageSchema validation
    const validPage = {
      items: [validNoteView, pendingReplacement],
      total: 2
    };
    expect(KnowledgePageSchema.safeParse(validPage).success).toBe(true);
    expect(KnowledgePageSchema.safeParse({ ...validPage, unauthorizedMeta: true }).success).toBe(false);
  });

  it('schemas_reject_malformed_hashes_and_states', () => {
    // RevisionHashSchema validates 64-char hex strings
    expect(RevisionHashSchema.safeParse(VALID_HASH).success).toBe(true);
    expect(RevisionHashSchema.safeParse(VALID_HASH_ALT).success).toBe(true);
    expect(RevisionHashSchema.safeParse('not-a-hash').success).toBe(false);
    expect(RevisionHashSchema.safeParse('e3b0c4').success).toBe(false); // Too short
    expect(RevisionHashSchema.safeParse(VALID_HASH + 'ff').success).toBe(false); // Too long
    expect(RevisionHashSchema.safeParse('z'.repeat(64)).success).toBe(false); // Non-hex characters

    // RevisionStateSchema validates enum ('active' | 'candidate' | 'deactive')
    expect(RevisionStateSchema.safeParse('active').success).toBe(true);
    expect(RevisionStateSchema.safeParse('candidate').success).toBe(true);
    expect(RevisionStateSchema.safeParse('deactive').success).toBe(true);
    expect(RevisionStateSchema.safeParse('deactivated').success).toBe(false);
    expect(RevisionStateSchema.safeParse('stale').success).toBe(false);
    expect(RevisionStateSchema.safeParse('unknown').success).toBe(false);

    // ReviewStatusSchema validates enum ('unreviewed' | 'approved' | 'rejected')
    expect(ReviewStatusSchema.safeParse('unreviewed').success).toBe(true);
    expect(ReviewStatusSchema.safeParse('approved').success).toBe(true);
    expect(ReviewStatusSchema.safeParse('rejected').success).toBe(true);
    expect(ReviewStatusSchema.safeParse('pending').success).toBe(false);
    expect(ReviewStatusSchema.safeParse('unknown').success).toBe(false);

    // NoteRevisionSchema rejects malformed hash
    expect(NoteRevisionSchema.safeParse({
      ...validNoteRevisionFixture,
      hash: 'invalid-hash'
    }).success).toBe(false);

    // NoteRevisionSchema rejects malformed state
    expect(NoteRevisionSchema.safeParse({
      ...validNoteRevisionFixture,
      state: 'invalid-state'
    }).success).toBe(false);

    // NoteRevisionSchema rejects malformed status
    expect(NoteRevisionSchema.safeParse({
      ...validNoteRevisionFixture,
      status: 'invalid-status'
    }).success).toBe(false);

    // PromoteCandidatePayloadSchema rejects malformed expectedHash
    expect(PromoteCandidatePayloadSchema.safeParse({
      ...validPromoteCandidatePayloadFixture,
      expectedHash: 'malformed'
    }).success).toBe(false);
  });
});
