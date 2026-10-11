import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { openStore, Store } from '../../storage/database';
import { KnowledgeRepository } from './repository';
import { reconcilePromotions } from './promotion';
import { RevisionStore } from './revision-store';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

describe('Promotion Journal and Crash Safety (P1-T3)', () => {
  let store: Store;
  let repo: KnowledgeRepository;
  let snapshotRoot: string;
  let snapshots: RevisionStore;
  const replacementHash = createHash('sha256').update('New content candidate').digest('hex');

  beforeEach(async () => {
    store = openStore(':memory:');
    repo = new KnowledgeRepository();
    snapshotRoot = mkdtempSync(join(tmpdir(), 'zhon-promotion-snapshots-'));
    snapshots = new RevisionStore({ revisionsDir: snapshotRoot });
    await snapshots.writeRevisionSnapshot('note-1', 'New content candidate');

    // Setup base note and initial revision
    const now = new Date().toISOString();
    repo.saveNote(store.connection, {
      id: 'note-1',
      title: 'Crash Safety Note',
      path: 'crash.md',
      current_revision_id: 'rev-1',
      scope_kind: 'global',
      scope_project_id: null,
      shared_with_project_ids: '[]',
      version: 1,
      availability: 'available',
      created_at: now,
      updated_at: now
    });

    repo.saveRevision(store.connection, {
      id: 'rev-1',
      note_id: 'note-1',
      content: 'Original content',
      hash: 'hash-rev-1-1111111111111111111111111111111111111111111111111111111111',
      state: 'active',
      status: 'approved',
      created_at: now,
      approved_at: now,
      origin: 'vault-import',
      parent_revision_id: null
    });

    repo.saveRevision(store.connection, {
      id: 'rev-2',
      note_id: 'note-1',
      content: 'New content candidate',
      hash: replacementHash,
      state: 'candidate',
      status: 'unreviewed',
      created_at: now,
      approved_at: null,
      origin: 'manual-edit',
      parent_revision_id: 'rev-1'
    });

    repo.saveCandidate(store.connection, {
      id: 'cand-2',
      revision_id: 'rev-2',
      version: 1,
      expected_source_hash: 'hash-rev-2-2222222222222222222222222222222222222222222222222222222222',
      state: 'pending',
      processing: 'ready',
      created_at: now,
      updated_at: now
    });
  });

  afterEach(() => {
    store.close();
    rmSync(snapshotRoot, { recursive: true, force: true });
  });

  it('interruption_before_pointer_keeps_old_active', async () => {
    const now = new Date().toISOString();
    // Simulate crashed promotion: intent was logged in promotions journal, but note pointer was NOT swapped
    repo.savePromotion(store.connection, {
      id: 'promo-interrupted-1',
      candidate_id: 'cand-2',
      note_id: 'note-1',
      revision_id: 'rev-2',
      source_hash: 'hash-rev-2-2222222222222222222222222222222222222222222222222222222222',
      stage: 'started',
      error: null,
      created_at: now,
      completed_at: null
    });

    // Reconcile on runtime restart
    const outcome = await reconcilePromotions(store, repo);
    expect(outcome.blocked).toBe(1);
    expect(outcome.completed).toBe(0);

    // Note active pointer still points to rev-1!
    const note = repo.findNoteById(store.connection, 'note-1');
    expect(note?.current_revision_id).toBe('rev-1');

    // Promotion record marked blocked
    const pending = repo.findPendingPromotions(store.connection);
    expect(pending.length).toBe(0);
  });

  it('interruption_after_pointer_completes_reconciliation', async () => {
    const now = new Date().toISOString();
    // Simulate crash after pointer was already swapped to rev-2, but promotion record not finalized
    repo.updateNoteActiveRevision(store.connection, 'note-1', 'rev-2', 2, now);
    repo.updateRevisionStatus(store.connection, 'rev-2', 'active', 'approved', now);

    repo.savePromotion(store.connection, {
      id: 'promo-interrupted-2',
      candidate_id: 'cand-2',
      note_id: 'note-1',
      revision_id: 'rev-2',
      source_hash: replacementHash,
      stage: 'started',
      error: null,
      created_at: now,
      completed_at: null
    });

    const outcome = await reconcilePromotions(store, repo, undefined, snapshots);
    expect(outcome.completed).toBe(1);
    expect(outcome.blocked).toBe(0);

    const note = repo.findNoteById(store.connection, 'note-1');
    expect(note?.current_revision_id).toBe('rev-2');

    // notes_fts virtual table was updated
    const ftsResults = repo.searchFts(store.connection, '"New content candidate"');
    expect(ftsResults.length).toBe(1);
  });
});
