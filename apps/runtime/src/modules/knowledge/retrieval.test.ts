import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { createHash } from 'node:crypto';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { openStore, Store } from '../../storage/database';
import { RegisteredRootPolicy } from '../../adapters/filesystem/registered-paths';
import { KnowledgeRepository } from './repository';
import { KnowledgeRetrievalService } from './retrieval';
import { KnowledgeReviewService } from './review';
import { RetrievalHitSchema, Scope } from '@zhon/contracts';

describe('Knowledge Retrieval, Scoping and Deactivation (P1-T3)', () => {
  let store: Store;
  let repo: KnowledgeRepository;
  let retrievalService: KnowledgeRetrievalService;
  let reviewService: KnowledgeReviewService;
  let now: string;
  let vaultRoot: string;

  beforeEach(() => {
    store = openStore(':memory:');
    vaultRoot = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'zhon-retrieval-')));
    store.connection.prepare('INSERT INTO vaults (id, root, version, created_at) VALUES (?, ?, ?, ?)').run('vault-1', vaultRoot, 1, new Date().toISOString());
    for (const [relativePath, content] of [
      ['projects/alpha/arch.md', 'Alpha confidential architecture details for project alpha.'],
      ['projects/beta/impl.md', 'Beta confidential implementation details for project beta.'],
      ['global/guidelines.md', 'Global company engineering guidelines and patterns.']
    ]) {
      const sourcePath = path.join(vaultRoot, relativePath);
      fs.mkdirSync(path.dirname(sourcePath), { recursive: true });
      fs.writeFileSync(sourcePath, content);
    }
    repo = new KnowledgeRepository();
    now = new Date().toISOString();
    retrievalService = new KnowledgeRetrievalService({ store, repo, clock: () => now });
    reviewService = new KnowledgeReviewService({ store, repo, clock: () => now });

    // Setup notes: Note A (proj-alpha), Note B (proj-beta), Note G (global)
    // 1. Note A (proj-alpha)
    repo.saveNote(store.connection, {
      id: 'note-alpha-1',
      title: 'Alpha Secret Architecture',
      path: 'projects/alpha/arch.md',
      current_revision_id: 'rev-a-1',
      scope_kind: 'project',
      scope_project_id: 'proj-alpha',
      shared_with_project_ids: '[]',
      version: 1,
      availability: 'available',
      created_at: now,
      updated_at: now
    });
    repo.saveRevision(store.connection, {
      id: 'rev-a-1',
      note_id: 'note-alpha-1',
      content: 'Alpha confidential architecture details for project alpha.',
      hash: createHash('sha256').update('Alpha confidential architecture details for project alpha.').digest('hex'),
      state: 'active',
      status: 'approved',
      created_at: now,
      approved_at: now,
      origin: 'vault-import',
      parent_revision_id: null
    });
    repo.upsertFts(
      store.connection,
      'note-alpha-1',
      'rev-a-1',
      'Alpha Secret Architecture',
      'Alpha confidential architecture details for project alpha.'
    );

    // 2. Note B (proj-beta)
    repo.saveNote(store.connection, {
      id: 'note-beta-1',
      title: 'Beta Secret Implementation',
      path: 'projects/beta/impl.md',
      current_revision_id: 'rev-b-1',
      scope_kind: 'project',
      scope_project_id: 'proj-beta',
      shared_with_project_ids: '[]',
      version: 1,
      availability: 'available',
      created_at: now,
      updated_at: now
    });
    repo.saveRevision(store.connection, {
      id: 'rev-b-1',
      note_id: 'note-beta-1',
      content: 'Beta confidential implementation details for project beta.',
      hash: createHash('sha256').update('Beta confidential implementation details for project beta.').digest('hex'),
      state: 'active',
      status: 'approved',
      created_at: now,
      approved_at: now,
      origin: 'vault-import',
      parent_revision_id: null
    });
    repo.upsertFts(
      store.connection,
      'note-beta-1',
      'rev-b-1',
      'Beta Secret Implementation',
      'Beta confidential implementation details for project beta.'
    );

    // 3. Note G (global)
    repo.saveNote(store.connection, {
      id: 'note-global-1',
      title: 'Global Guidelines',
      path: 'global/guidelines.md',
      current_revision_id: 'rev-g-1',
      scope_kind: 'global',
      scope_project_id: null,
      shared_with_project_ids: '[]',
      version: 1,
      availability: 'available',
      created_at: now,
      updated_at: now
    });
    repo.saveRevision(store.connection, {
      id: 'rev-g-1',
      note_id: 'note-global-1',
      content: 'Global company engineering guidelines and patterns.',
      hash: createHash('sha256').update('Global company engineering guidelines and patterns.').digest('hex'),
      state: 'active',
      status: 'approved',
      created_at: now,
      approved_at: now,
      origin: 'vault-import',
      parent_revision_id: null
    });
    repo.upsertFts(
      store.connection,
      'note-global-1',
      'rev-g-1',
      'Global Guidelines',
      'Global company engineering guidelines and patterns.'
    );
  });

  afterEach(() => {
    store.close();
    fs.rmSync(vaultRoot, { recursive: true, force: true });
  });

  it('cross_project_private_hit_never_returned', async () => {
    const alphaScope: Scope = { kind: 'project', projectId: 'proj-alpha' };
    const hitsAlpha = await retrievalService.retrieveActive({
      scope: alphaScope,
      text: 'confidential'
    });

    // Only Alpha's note is returned; Beta's private note is NEVER returned
    expect(hitsAlpha.length).toBe(1);
    expect(hitsAlpha[0].noteId).toBe('note-alpha-1');

    const betaScope: Scope = { kind: 'project', projectId: 'proj-beta' };
    const hitsBeta = await retrievalService.retrieveActive({
      scope: betaScope,
      text: 'confidential'
    });

    expect(hitsBeta.length).toBe(1);
    expect(hitsBeta[0].noteId).toBe('note-beta-1');
  });

  it('foreignProjectDeniedUntilExplicitShare and sourceRepositoryStillDeniedAfterNoteShare', async () => {
    const alphaScope: Scope = { kind: 'project', projectId: 'proj-alpha' };

    // Initially, proj-alpha queries for Beta note -> denied (empty)
    const initialHits = await retrievalService.retrieveActive({
      scope: alphaScope,
      text: 'Beta Secret'
    });
    expect(initialHits.length).toBe(0);

    // Explicit BOSS shareNote command
    const shareResult = await reviewService.shareNote({
      noteId: 'note-beta-1',
      expectedVersion: 1,
      expectedActiveHash: createHash('sha256').update('Beta confidential implementation details for project beta.').digest('hex'),
      projectIds: ['proj-alpha']
    });
    expect(shareResult.ok).toBe(true);

    // Now proj-alpha CAN retrieve Note Beta
    const sharedHits = await retrievalService.retrieveActive({
      scope: alphaScope,
      text: 'Beta Secret'
    });
    expect(sharedHits.length).toBe(1);
    expect(sharedHits[0].noteId).toBe('note-beta-1');

    // sourceRepositoryStillDeniedAfterNoteShare: filesystem policy remains strictly bound to alpha repo
    const tempAlpha = fs.mkdtempSync(path.join(os.tmpdir(), 'alpha-repo-'));
    const tempBeta = fs.mkdtempSync(path.join(os.tmpdir(), 'beta-repo-'));
    try {
      const alphaPolicy = new RegisteredRootPolicy([tempAlpha]);
      expect(alphaPolicy.validate(path.join(tempBeta, 'secret.txt')).ok).toBe(false);
    } finally {
      fs.rmSync(tempAlpha, { recursive: true, force: true });
      fs.rmSync(tempBeta, { recursive: true, force: true });
    }
  });

  it('deactivation_excludes_next_query', async () => {
    // Note G is active initially
    const beforeHits = await retrievalService.retrieveActive({
      scope: { kind: 'global' },
      text: 'Global'
    });
    expect(beforeHits.length).toBe(1);

    // Deactivate note
    const deactResult = await reviewService.deactivateNote({
      noteId: 'note-global-1',
      expectedVersion: 1
    });
    expect(deactResult.ok).toBe(true);

    // Next query excludes deactivated note
    const afterHits = await retrievalService.retrieveActive({
      scope: { kind: 'global' },
      text: 'Global'
    });
    expect(afterHits.length).toBe(0);

    // searchKnowledge column: 'active' also excludes it
    const activePage = await retrievalService.searchKnowledge({
      scope: { kind: 'global' },
      column: 'active',
      text: 'Global'
    });
    expect(activePage.ok).toBe(true);
    if (!activePage.ok) throw new Error('activePage failed');
    expect(activePage.value.items.length).toBe(0);

    // But searchKnowledge column: 'deactivated' returns it
    const deactPage = await retrievalService.searchKnowledge({
      scope: { kind: 'global' },
      column: 'deactivated'
    });
    expect(deactPage.ok).toBe(true);
    if (!deactPage.ok) throw new Error('deactPage failed');
    expect(deactPage.value.items.some((item: { id: string }) => item.id === 'note-global-1')).toBe(true);
  });

  it('malformed_fts_query_safe', async () => {
    // Malformed FTS queries with operators, quotes and syntax tokens
    const malformedQueries = [
      '"""*** AND OR NOT (((( ::: foo',
      'title:test* OR NOT AND',
      'unclosed " quote',
      'NEAR/2 (broken',
      '\\//???$$$@@@'
    ];

    for (const q of malformedQueries) {
      const result = await retrievalService.retrieveActive({
        scope: { kind: 'global' },
        text: q
      });
      // Does not throw syntax error and returns array
      expect(Array.isArray(result)).toBe(true);
    }
  });

  it('retrieve_active_exact_hits validates schema', async () => {
    const hits = await retrievalService.retrieveActive({
      scope: { kind: 'global' }
    });

    expect(hits.length).toBeGreaterThan(0);
    for (const hit of hits) {
      expect(RetrievalHitSchema.safeParse(hit).success).toBe(true);
      expect(hit.contentHash).toMatch(/^[a-f0-9]{64}$/);
    }
  });
});
