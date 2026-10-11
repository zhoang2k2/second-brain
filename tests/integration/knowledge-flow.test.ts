import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { openStore, Store } from '../../apps/runtime/src/storage/database';
import { RegisteredRootPolicy } from '../../apps/runtime/src/adapters/filesystem/registered-paths';
import { RevisionStore } from '../../apps/runtime/src/modules/knowledge/revision-store';
import { KnowledgeRepository } from '../../apps/runtime/src/modules/knowledge/repository';
import { KnowledgeIngestionService } from '../../apps/runtime/src/modules/knowledge/ingestion';
import { KnowledgeReviewService } from '../../apps/runtime/src/modules/knowledge/review';
import { KnowledgeRetrievalService } from '../../apps/runtime/src/modules/knowledge/retrieval';
import { reconcilePromotions } from '../../apps/runtime/src/modules/knowledge/promotion';

interface FlowFixture {
  tempDir: string;
  vaultDir: string;
  revisionsDir: string;
  dbPath: string;
  store: Store;
  repo: KnowledgeRepository;
  revisionStore: RevisionStore;
  ingestion: KnowledgeIngestionService;
  reviewService: KnowledgeReviewService;
  retrievalService: KnowledgeRetrievalService;
  vaultId: string;
  writeVaultNote(filename: string, content: string): string;
  readVaultNote(filename: string): string;
  cleanup(): void;
}

function createFlowFixture(): FlowFixture {
  const tempDir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'zhon-knowledge-flow-')));
  const vaultDir = path.join(tempDir, 'vault');
  const revisionsDir = path.join(tempDir, 'revisions');
  const dbPath = path.join(tempDir, 'runtime.db');

  fs.mkdirSync(vaultDir, { recursive: true });
  fs.mkdirSync(revisionsDir, { recursive: true });

  const store = openStore(dbPath);
  const repo = new KnowledgeRepository();
  const revisionStore = new RevisionStore({ revisionsDir });
  const policy = new RegisteredRootPolicy([vaultDir]);

  const vaultId = 'vault-main';
  store.connection.prepare(
    "INSERT INTO vaults (id, root, version, created_at) VALUES (?, ?, ?, ?)"
  ).run(vaultId, vaultDir, 1, '2026-10-10T12:00:00Z');

  const ingestion = new KnowledgeIngestionService({
    store,
    repo,
    revisionStore,
    policy
  });

  const clock = () => '2026-10-10T12:00:00Z';
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
    tempDir,
    vaultDir,
    revisionsDir,
    dbPath,
    store,
    repo,
    revisionStore,
    ingestion,
    reviewService,
    retrievalService,
    vaultId,
    writeVaultNote(filename: string, content: string) {
      const fullPath = path.join(vaultDir, filename);
      fs.mkdirSync(path.dirname(fullPath), { recursive: true });
      fs.writeFileSync(fullPath, content, 'utf8');
      return fullPath;
    },
    readVaultNote(filename: string) {
      return fs.readFileSync(path.join(vaultDir, filename), 'utf8');
    },
    cleanup() {
      try {
        store.close();
      } catch {}
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch {}
    }
  };
}

describe('Phase P1 Knowledge Flow Integration Tests', () => {
  let fixture: FlowFixture;

  beforeEach(() => {
    fixture = createFlowFixture();
  });

  afterEach(() => {
    fixture.cleanup();
  });

  it('manual_save_candidate_then_active', async () => {
    // 1. Write manual note to vault
    fixture.writeVaultNote('retry.md', '# A saved lesson\nContent about retry handling.');

    // 2. Capture note into runtime
    const captureResult = await fixture.ingestion.captureNote({
      vaultId: fixture.vaultId,
      path: 'retry.md'
    });
    expect(captureResult.ok).toBe(true);
    if (!captureResult.ok) throw new Error('Capture failed');

    const { note, candidate, revision } = captureResult.value;
    expect(note.version).toBe(1);
    expect(candidate.state).toBe('pending');
    const revDb = fixture.repo.findRevisionById(fixture.store.connection, revision.id);
    expect(revDb?.state).toBe('candidate');

    // Candidate notes appear in candidate column
    const candidates = fixture.repo.listCandidates(fixture.store.connection, 'pending');
    expect(candidates.some(c => c.id === candidate.id)).toBe(true);

    // Active retrieve returns 0 items before approval
    const beforeApproval = await fixture.retrievalService.retrieveActive({
      scope: { kind: 'global' },
      text: 'retry'
    });
    expect(beforeApproval.length).toBe(0);

    // 3. Approve candidate
    const approveResult = await fixture.reviewService.approveCandidate({
      candidateId: candidate.id,
      candidateVersion: candidate.version,
      expectedSourceHash: candidate.expectedSourceHash
    });
    expect(approveResult.ok).toBe(true);

    // 4. Active retrieve returns approved note
    const afterApproval = await fixture.retrievalService.retrieveActive({
      scope: { kind: 'global' },
      text: 'retry'
    });
    expect(afterApproval.length).toBe(1);
    expect(afterApproval[0].noteId).toBe(note.id);
    expect(afterApproval[0].sourcePath).toBe('retry.md');
  });

  it('manual_edit_keeps_old_active', async () => {
    // 1. Initial capture and approval
    fixture.writeVaultNote('doc.md', '# Original Title\nOriginal approved content.');
    const firstCapture = await fixture.ingestion.captureNote({
      vaultId: fixture.vaultId,
      path: 'doc.md'
    });
    if (!firstCapture.ok) throw new Error('First capture failed');

    await fixture.reviewService.approveCandidate({
      candidateId: firstCapture.value.candidate.id,
      candidateVersion: firstCapture.value.candidate.version,
      expectedSourceHash: firstCapture.value.candidate.expectedSourceHash
    });

    const activeBeforeEdit = await fixture.retrievalService.retrieveActive({
      scope: { kind: 'global' },
      text: 'Original'
    });
    expect(activeBeforeEdit.length).toBe(1);
    expect(activeBeforeEdit[0].excerpt).toContain('Original approved content');

    // 2. Manual edit on disk
    fixture.writeVaultNote('doc.md', '# Modified Title\nUnreviewed draft content.');
    const secondCapture = await fixture.ingestion.captureNote({
      vaultId: fixture.vaultId,
      path: 'doc.md'
    });
    expect(secondCapture.ok).toBe(true);
    if (!secondCapture.ok) throw new Error('Second capture failed');
    expect(secondCapture.value.candidate.state).toBe('pending');

    // 3. Search must still return OLD active revision, NOT the unreviewed draft!
    const activeDuringReview = await fixture.retrievalService.retrieveActive({
      scope: { kind: 'global' },
      text: 'Original'
    });
    expect(activeDuringReview.length).toBe(1);
    expect(activeDuringReview[0].excerpt).toContain('Original approved content');

    const draftSearch = await fixture.retrievalService.retrieveActive({
      scope: { kind: 'global' },
      text: 'Unreviewed'
    });
    expect(draftSearch.length).toBe(0);
  });

  it('rejected_candidate_not_reactivated_on_restart', async () => {
    fixture.writeVaultNote('rejected.md', '# Proposed Idea\nControversial suggestion.');
    const capture = await fixture.ingestion.captureNote({
      vaultId: fixture.vaultId,
      path: 'rejected.md'
    });
    if (!capture.ok) throw new Error('Capture failed');

    // Reject candidate
    const rejectResult = await fixture.reviewService.rejectCandidate({
      candidateId: capture.value.candidate.id,
      candidateVersion: capture.value.candidate.version,
      expectedSourceHash: capture.value.candidate.expectedSourceHash
    });
    expect(rejectResult.ok).toBe(true);

    // Verify candidate is rejected
    const candAfterReject = fixture.repo.findCandidateById(
      fixture.store.connection,
      capture.value.candidate.id
    );
    expect(candAfterReject?.state).toBe('rejected');

    // Simulate restart with same SQLite database
    fixture.store.close();
    const restartedStore = openStore(fixture.dbPath);
    const restartedRepo = new KnowledgeRepository();
    const restartedIngestion = new KnowledgeIngestionService({
      store: restartedStore,
      repo: restartedRepo,
      revisionStore: fixture.revisionStore,
      policy: new RegisteredRootPolicy([fixture.vaultDir])
    });

    // Rescan vault on startup
    await restartedIngestion.rescanVault(fixture.vaultId);

    // Rejected candidate must NOT be reactivated
    const candAfterRestart = restartedRepo.findCandidateById(
      restartedStore.connection,
      capture.value.candidate.id
    );
    expect(candAfterRestart?.state).toBe('rejected');

    const pendingCandidates = restartedRepo.listCandidates(restartedStore.connection, 'pending');
    expect(pendingCandidates.some(c => c.id === capture.value.candidate.id)).toBe(false);

    restartedStore.close();
    // Re-open store so cleanup does not throw
    fixture.store = openStore(fixture.dbPath);
  });

  it('restart_during_promotion_preserves_source', async () => {
    fixture.writeVaultNote('promo.md', '# Promotion Crash Test\nOriginal resilient content.');
    const capture = await fixture.ingestion.captureNote({
      vaultId: fixture.vaultId,
      path: 'promo.md'
    });
    if (!capture.ok) throw new Error('Capture failed');

    // Create an interrupted promotion journal record (stage: intent_recorded)
    fixture.repo.savePromotion(fixture.store.connection, {
      id: 'promo-crash-1',
      candidate_id: capture.value.candidate.id,
      note_id: capture.value.note.id,
      revision_id: capture.value.revision.id,
      source_hash: capture.value.candidate.expectedSourceHash,
      stage: 'intent_recorded',
      error: null,
      created_at: '2026-10-10T12:00:00Z',
      completed_at: null
    });

    // Simulate restart & run promotion reconciliation
    fixture.store.close();
    const restartedStore = openStore(fixture.dbPath);
    const restartedRepo = new KnowledgeRepository();

    const reconciled = await reconcilePromotions(restartedStore, restartedRepo);
    expect(reconciled.blocked).toBe(1);
    expect(reconciled.completed).toBe(0);

    // Active pointer was never swapped, so note has no active revision
    const note = restartedRepo.findNoteById(restartedStore.connection, capture.value.note.id);
    expect(note?.current_revision_id).toBeNull();

    // Source file on disk remains intact
    const diskContent = fs.readFileSync(path.join(fixture.vaultDir, 'promo.md'), 'utf8');
    expect(diskContent).toBe('# Promotion Crash Test\nOriginal resilient content.');

    restartedStore.close();
    fixture.store = openStore(fixture.dbPath);
  });

  it('project_a_cannot_query_project_b_private', async () => {
    // Note in Project A
    fixture.writeVaultNote('proj-a.md', '# Note A\nConfidential architecture for Project A.');
    const capA = await fixture.ingestion.captureNote({
      vaultId: fixture.vaultId,
      path: 'proj-a.md',
      defaultScope: { kind: 'project', projectId: 'project-a' }
    });
    if (!capA.ok) throw new Error('Cap A failed');
    await fixture.reviewService.approveCandidate({
      candidateId: capA.value.candidate.id,
      candidateVersion: capA.value.candidate.version,
      expectedSourceHash: capA.value.candidate.expectedSourceHash
    });

    // Note in Project B
    fixture.writeVaultNote('proj-b.md', '# Note B\nSecret roadmap for Project B.');
    const capB = await fixture.ingestion.captureNote({
      vaultId: fixture.vaultId,
      path: 'proj-b.md',
      defaultScope: { kind: 'project', projectId: 'project-b' }
    });
    if (!capB.ok) throw new Error('Cap B failed');
    await fixture.reviewService.approveCandidate({
      candidateId: capB.value.candidate.id,
      candidateVersion: capB.value.candidate.version,
      expectedSourceHash: capB.value.candidate.expectedSourceHash
    });

    // Query from Project A: never sees Note B
    const queryA = await fixture.retrievalService.retrieveActive({
      scope: { kind: 'project', projectId: 'project-a' }
    });
    expect(queryA.some(h => h.noteId === capA.value.note.id)).toBe(true);
    expect(queryA.some(h => h.noteId === capB.value.note.id)).toBe(false);

    // Query from Project B: never sees Note A
    const queryB = await fixture.retrievalService.retrieveActive({
      scope: { kind: 'project', projectId: 'project-b' }
    });
    expect(queryB.some(h => h.noteId === capB.value.note.id)).toBe(true);
    expect(queryB.some(h => h.noteId === capA.value.note.id)).toBe(false);

    // Share Note A with Project B
    const shareResult = await fixture.reviewService.shareNote({
      noteId: capA.value.note.id,
      expectedVersion: capA.value.note.version + 1,
      expectedActiveHash: capA.value.candidate.expectedSourceHash,
      projectIds: ['project-b']
    });
    expect(shareResult.ok).toBe(true);

    // Query from Project B now sees Note A AND Note B
    const queryBAfterShare = await fixture.retrievalService.retrieveActive({
      scope: { kind: 'project', projectId: 'project-b' }
    });
    expect(queryBAfterShare.some(h => h.noteId === capA.value.note.id)).toBe(true);
    expect(queryBAfterShare.some(h => h.noteId === capB.value.note.id)).toBe(true);

    // But Query from Project A still cannot see Note B (unidirectional share)
    const queryAAfterShare = await fixture.retrievalService.retrieveActive({
      scope: { kind: 'project', projectId: 'project-a' }
    });
    expect(queryAAfterShare.some(h => h.noteId === capB.value.note.id)).toBe(false);
  });

  it('search_without_model', async () => {
    fixture.writeVaultNote('algorithms.md', '# Sorting Algorithms\nQuickSort has O(n log n) average complexity.');
    fixture.writeVaultNote('database.md', '# SQLite Architecture\nB-tree indexing and Write-Ahead Logging WAL.');

    const cap1 = await fixture.ingestion.captureNote({ vaultId: fixture.vaultId, path: 'algorithms.md' });
    const cap2 = await fixture.ingestion.captureNote({ vaultId: fixture.vaultId, path: 'database.md' });
    if (!cap1.ok || !cap2.ok) throw new Error('Capture failed');

    await fixture.reviewService.approveCandidate({
      candidateId: cap1.value.candidate.id,
      candidateVersion: cap1.value.candidate.version,
      expectedSourceHash: cap1.value.candidate.expectedSourceHash
    });
    await fixture.reviewService.approveCandidate({
      candidateId: cap2.value.candidate.id,
      candidateVersion: cap2.value.candidate.version,
      expectedSourceHash: cap2.value.candidate.expectedSourceHash
    });

    // Pure SQLite FTS5 search — zero external AI models invoked
    const hitsAlgo = await fixture.retrievalService.retrieveActive({
      scope: { kind: 'global' },
      text: 'QuickSort'
    });
    expect(hitsAlgo.length).toBe(1);
    expect(hitsAlgo[0].sourcePath).toBe('algorithms.md');
    expect(hitsAlgo[0].excerpt).toContain('QuickSort');

    const hitsDb = await fixture.retrievalService.retrieveActive({
      scope: { kind: 'global' },
      text: 'Write-Ahead'
    });
    expect(hitsDb.length).toBe(1);
    expect(hitsDb[0].sourcePath).toBe('database.md');
  });

  it('invalid_yaml_frontmatter_captured_safely', async () => {
    // Write note with broken/unparseable YAML frontmatter (unclosed or malformed colon)
    fixture.writeVaultNote('broken-fm.md', '---\n: malformed_colon_start\n---\n# Broken Title\nContent here.');
    const result = await fixture.ingestion.captureNote({
      vaultId: fixture.vaultId,
      path: 'broken-fm.md'
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('INCOMPLETE_YAML');
    }
  });

  it('source_exceeding_1mib_rejected', async () => {
    // Write note file larger than 1 MiB (> 1048576 bytes)
    const largeContent = '---\ntitle: Large Note\n---\n' + 'a'.repeat(1048600);
    fixture.writeVaultNote('large.md', largeContent);
    const result = await fixture.ingestion.captureNote({
      vaultId: fixture.vaultId,
      path: 'large.md'
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('NOTE_TOO_LARGE');
    }
  });

  it('symlink_outside_vault_denied', async () => {
    // Create an external file in os.tmpdir()
    const externalFile = path.join(os.tmpdir(), `external-${Date.now()}.md`);
    fs.writeFileSync(externalFile, '# External Secret\nExternal content.', 'utf8');

    // Create symlink inside vault pointing to external file
    const symlinkPath = path.join(fixture.vaultDir, 'symlink.md');
    try {
      fs.symlinkSync(externalFile, symlinkPath);
    } catch {
      // If symlinks are not permitted on this system/user, skip or test gracefully
    }

    if (fs.existsSync(symlinkPath)) {
      const result = await fixture.ingestion.captureNote({
        vaultId: fixture.vaultId,
        path: 'symlink.md'
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('PATH_OUT_OF_SCOPE');
      }
      try {
        fs.unlinkSync(externalFile);
      } catch {}
    }
  });

  it('crash_journal_reconciliation_cleans_uncommitted_state', async () => {
    fixture.writeVaultNote('crash-promo.md', '# Crash Promo\nContent for crash recovery.');
    const capture = await fixture.ingestion.captureNote({
      vaultId: fixture.vaultId,
      path: 'crash-promo.md'
    });
    if (!capture.ok) throw new Error('Capture failed');

    // Simulate an interrupted promotion row in the promotions table (stage: intent_recorded)
    fixture.repo.savePromotion(fixture.store.connection, {
      id: 'promo-crash-edge-1',
      candidate_id: capture.value.candidate.id,
      note_id: capture.value.note.id,
      revision_id: capture.value.revision.id,
      source_hash: capture.value.candidate.expectedSourceHash,
      stage: 'intent_recorded',
      error: null,
      created_at: '2026-10-10T12:00:00Z',
      completed_at: null
    });

    // Run reconcilePromotions
    const reconciliationResult = await reconcilePromotions(fixture.store, fixture.repo);
    expect(reconciliationResult.blocked).toBe(1);
    expect(reconciliationResult.completed).toBe(0);

    // Verify promotion row status is updated to blocked/cleaned and state is cleanly recovered
    const promoRecord = fixture.repo.findPromotionById(fixture.store.connection, 'promo-crash-edge-1');
    expect(promoRecord?.stage).toBe('blocked');
    expect(promoRecord?.error).toBe('INTERRUPTED_BEFORE_POINTER');
  });
});
