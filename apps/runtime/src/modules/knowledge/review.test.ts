import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { openStore, Store } from '../../storage/database';
import { RegisteredRootPolicy } from '../../adapters/filesystem/registered-paths';
import { RevisionStore } from './revision-store';
import { KnowledgeRepository } from './repository';
import { KnowledgeIngestionService } from './ingestion';
import { KnowledgeReviewService } from './review';
import { KnowledgeRetrievalService } from './retrieval';
import { RetrievalHit, Result, NoteView, RevisionView, CandidateView } from '@zhon/contracts';

export interface TestReviewResult {
  ok: boolean;
  value: NoteView;
  error: { code: string; message: string; retryable: boolean };
}

interface ReviewTestFixture {
  store: Store;
  repo: KnowledgeRepository;
  revisionStore: RevisionStore;
  ingestion: KnowledgeIngestionService;
  reviewService: KnowledgeReviewService;
  retrievalService: KnowledgeRetrievalService;
  vaultId: string;
  vaultRoot: string;
  revisionsRoot: string;
  oldRevisionId: string;
  noteId: string;
  writeVaultFile(relPath: string, content: string): void;
  editActiveNote(content: string): Promise<Result<{ note: NoteView; revision: RevisionView; candidate: CandidateView }>>;
  retrieve(text?: string): Promise<RetrievalHit[]>;
  approveAfterConcurrentEdit(): Promise<TestReviewResult>;
  sourceContents(): Promise<string>;
  cleanup(): void;
}

function createReviewFixture(): ReviewTestFixture {
  const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zhon-review-fixture-'));
  const vaultRoot = path.join(baseDir, 'vault');
  const revisionsRoot = path.join(baseDir, 'revisions');
  fs.mkdirSync(vaultRoot, { recursive: true });
  fs.mkdirSync(revisionsRoot, { recursive: true });

  const store = openStore(':memory:');
  const vaultId = 'vault-review-1';
  store.connection.prepare(
    'INSERT INTO vaults (id, root, version, created_at) VALUES (?, ?, ?, ?)'
  ).run(vaultId, fs.realpathSync(vaultRoot), 1, new Date().toISOString());

  const policy = new RegisteredRootPolicy([vaultRoot]);
  const revisionStore = new RevisionStore({ revisionsDir: revisionsRoot });
  const repo = new KnowledgeRepository();
  const clock = () => new Date().toISOString();

  const ingestion = new KnowledgeIngestionService({
    store,
    repo,
    revisionStore,
    policy,
    clock
  });

  const reviewService = new KnowledgeReviewService({
    store,
    repo,
    revisionStore,
    clock
  });

  const retrievalService = new KnowledgeRetrievalService({
    store,
    repo,
    clock
  });

  return {
    store,
    repo,
    revisionStore,
    ingestion,
    reviewService,
    retrievalService,
    vaultId,
    vaultRoot,
    revisionsRoot,
    oldRevisionId: '',
    noteId: '',
    writeVaultFile(relPath: string, content: string) {
      const full = path.join(vaultRoot, relPath);
      fs.mkdirSync(path.dirname(full), { recursive: true });
      fs.writeFileSync(full, content, 'utf8');
    },
    async editActiveNote(content: string) {
      this.writeVaultFile('note.md', content);
      return ingestion.captureNote({ vaultId, path: 'note.md' });
    },
    async retrieve(text?: string) {
      return retrievalService.retrieveActive({
        scope: { kind: 'global' },
        text
      });
    },
    async approveAfterConcurrentEdit() {
      // Manual concurrent edit directly on disk after candidate was captured
      this.writeVaultFile('note.md', 'latest manual edit');
      const pendingCand = repo.findPendingCandidateByNoteId(store.connection, this.noteId);
      if (!pendingCand) {
        throw new Error('No pending candidate found');
      }
      return (await reviewService.approveCandidate({
        candidateId: pendingCand.id,
        candidateVersion: pendingCand.version,
        expectedSourceHash: pendingCand.expected_source_hash
      })) as unknown as TestReviewResult;
    },
    async sourceContents() {
      return fs.readFileSync(path.join(vaultRoot, 'note.md'), 'utf8');
    },
    cleanup() {
      store.close();
      fs.rmSync(baseDir, { recursive: true, force: true });
    }
  };
}

describe('Knowledge Review and Lifecycle (P1-T3)', () => {
  let fixture: ReviewTestFixture;

  beforeEach(async () => {
    fixture = createReviewFixture();
    // Setup initial approved note
    fixture.writeVaultFile('note.md', '# Initial Title\nold revision content for testing');
    const initial = await fixture.ingestion.captureNote({ vaultId: fixture.vaultId, path: 'note.md' });
    expect(initial.ok).toBe(true);
    if (!initial.ok) throw new Error('Initial capture failed');

    const approveResult = await fixture.reviewService.approveCandidate({
      candidateId: initial.value.candidate.id,
      candidateVersion: initial.value.candidate.version,
      expectedSourceHash: initial.value.candidate.expectedSourceHash
    });
    expect(approveResult.ok).toBe(true);

    fixture.oldRevisionId = initial.value.revision.id;
    fixture.noteId = initial.value.note.id;
  });

  afterEach(() => {
    fixture.cleanup();
  });

  it('old_active_survives_edit_or_rejection and source_cas_preserves_new_manual_edit', async () => {
    // 1. Edit active note -> new candidate created, old active survives
    await fixture.editActiveNote('new content');
    const hits = await fixture.retrieve('old');
    expect(hits.at(0)?.revisionId).toBe(fixture.oldRevisionId);

    // 2. Intervening disk modification before approval -> source CAS fails with STALE_CANDIDATE
    const staleResult = await fixture.approveAfterConcurrentEdit();
    expect(staleResult.ok).toBe(false);
    expect(staleResult.error.code).toBe('STALE_CANDIDATE');

    // 3. Source content on disk was preserved (not overwritten by candidate)
    expect(await fixture.sourceContents()).toBe('latest manual edit');

    // 4. Old active revision is STILL retrieved
    const stillActiveHits = await fixture.retrieve('old');
    expect(stillActiveHits.at(0)?.revisionId).toBe(fixture.oldRevisionId);

    // 5. Reject candidate also leaves old active revision intact
    await fixture.editActiveNote('content intended to be rejected');
    const pendingCand = fixture.repo.findPendingCandidateByNoteId(fixture.store.connection, fixture.noteId);
    expect(pendingCand).toBeDefined();

    const rejectResult = await fixture.reviewService.rejectCandidate({
      candidateId: pendingCand!.id,
      candidateVersion: pendingCand!.version,
      expectedSourceHash: pendingCand!.expected_source_hash
    });
    expect(rejectResult.ok).toBe(true);

    const activeHitsAfterReject = await fixture.retrieve('old');
    expect(activeHitsAfterReject.at(0)?.revisionId).toBe(fixture.oldRevisionId);
  });

  it('stale_hash_refuses_approval', async () => {
    await fixture.editActiveNote('stale candidate content');
    const pendingCand = fixture.repo.findPendingCandidateByNoteId(fixture.store.connection, fixture.noteId);
    expect(pendingCand).toBeDefined();

    // Review with mismatched expectedSourceHash
    const wrongHash = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
    const result = await fixture.reviewService.approveCandidate({
      candidateId: pendingCand!.id,
      candidateVersion: pendingCand!.version,
      expectedSourceHash: wrongHash
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected failure');
    expect(result.error.code).toBe('STALE_CANDIDATE');
  });

  it('concurrent_approval_single_winner', async () => {
    await fixture.editActiveNote('concurrent content');
    const pendingCand = fixture.repo.findPendingCandidateByNoteId(fixture.store.connection, fixture.noteId);
    expect(pendingCand).toBeDefined();

    const input = {
      candidateId: pendingCand!.id,
      candidateVersion: pendingCand!.version,
      expectedSourceHash: pendingCand!.expected_source_hash
    };

    // First approval succeeds
    const firstWinner = await fixture.reviewService.approveCandidate(input);
    expect(firstWinner.ok).toBe(true);

    // Second approval for same candidate fails as STALE_CANDIDATE
    const secondAttempt = await fixture.reviewService.approveCandidate(input);
    expect(secondAttempt.ok).toBe(false);
    if (secondAttempt.ok) throw new Error('Expected failure');
    expect(secondAttempt.error.code).toBe('STALE_CANDIDATE');
  });

  it('rollback_reselects_exact_previously_approved_revision', async () => {
    const rev1Id = fixture.oldRevisionId;

    // Create and approve revision 2
    await fixture.editActiveNote('revision 2 content with new features');
    const cand2 = fixture.repo.findPendingCandidateByNoteId(fixture.store.connection, fixture.noteId);
    const approve2 = await fixture.reviewService.approveCandidate({
      candidateId: cand2!.id,
      candidateVersion: cand2!.version,
      expectedSourceHash: cand2!.expected_source_hash
    });
    expect(approve2.ok).toBe(true);
    if (!approve2.ok) throw new Error('approve2 failed');
    expect(approve2.value.activeRevisionId).not.toBe(rev1Id);

    // Attempt rollback with wrong version
    const badRollback = await fixture.reviewService.rollbackNote({
      noteId: fixture.noteId,
      revisionId: rev1Id,
      expectedVersion: 999
    });
    expect(badRollback.ok).toBe(false);
    if (badRollback.ok) throw new Error('Expected failure');
    expect(badRollback.error.code).toBe('VERSION_CONFLICT');

    // Rollback to revision 1 with correct version
    const rollback = await fixture.reviewService.rollbackNote({
      noteId: fixture.noteId,
      revisionId: rev1Id,
      expectedVersion: approve2.value.version
    });
    expect(rollback.ok).toBe(true);
    if (!rollback.ok) throw new Error('rollback failed');
    expect(rollback.value.activeRevisionId).toBe(rev1Id);

    // Retrieval now returns revision 1 content
    const hits = await fixture.retrieve('old');
    expect(hits.length).toBe(1);
    expect(hits[0].revisionId).toBe(rev1Id);
  });
});
