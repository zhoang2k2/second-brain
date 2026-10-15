import fastify, { FastifyInstance } from 'fastify';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { createHash } from 'node:crypto';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { openStore, Store } from '../../storage/database';
import { KnowledgeRepository } from './repository';
import { KnowledgeReviewService } from './review';
import { KnowledgeRetrievalService } from './retrieval';
import { KnowledgeIngestionService } from './ingestion';
import { knowledgeRoutes } from './routes';
import { RevisionStore } from './revision-store';

describe('Knowledge Routes', () => {
  let app: FastifyInstance;
  let store: Store;
  let repo: KnowledgeRepository;
  let reviewService: KnowledgeReviewService;
  let retrievalService: KnowledgeRetrievalService;
  let vaultRoot: string;
  const candidateMarkdown = '# Route Test Cand\nCandidate content.';
  const candidateHash = createHash('sha256').update(candidateMarkdown).digest('hex');
  const activeHash = createHash('sha256').update('# Route Test\nTesting fastify knowledge routes.').digest('hex');

  beforeEach(async () => {
    store = openStore(':memory:');
    vaultRoot = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'zhon-routes-')));
    fs.mkdirSync(path.join(vaultRoot, 'routes'));
    fs.writeFileSync(path.join(vaultRoot, 'routes/note.md'), candidateMarkdown);
    store.connection.prepare('INSERT INTO vaults (id, root, version, created_at) VALUES (?, ?, ?, ?)').run('vault-1', vaultRoot, 1, '2026-10-10T12:00:00Z');
    repo = new KnowledgeRepository();
    const clock = () => '2026-10-10T12:00:00Z';
    const revisionStore = new RevisionStore({ revisionsDir: path.join(vaultRoot, '.revisions') });
    await revisionStore.writeRevisionSnapshot('note-route-1', candidateMarkdown);
    reviewService = new KnowledgeReviewService({ store, repo, clock, revisionStore });
    retrievalService = new KnowledgeRetrievalService({ store, repo, clock });

    const mockIngestion = {
      captureNote: async (input: { vaultId: string; path: string }) => ({
        ok: true,
        value: {
          note: { id: 'note-cap-1', path: input.path, scope: { kind: 'global' }, version: 1, availability: 'available', sharedWithProjectIds: [] },
          revision: { id: 'rev-cap-1', noteId: 'note-cap-1', contentHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', markdown: 'Captured', origin: 'vault-import' },
          candidate: { id: 'cand-cap-1', revisionId: 'rev-cap-1', noteVersion: 1, expectedSourceHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', state: 'pending', processing: 'ready' }
        }
      }),
      rescanVault: async () => ({ captured: 2, blocked: 0 })
    } as unknown as KnowledgeIngestionService;

    app = fastify({ logger: false });
    await app.register(knowledgeRoutes, { reviewService, retrievalService, ingestionService: mockIngestion });
    await app.ready();

    // Populate a test note
    repo.saveNote(store.connection, {
      id: 'note-route-1',
      title: 'Route Test Note',
      path: 'routes/note.md',
      current_revision_id: 'rev-r-1',
      scope_kind: 'global',
      scope_project_id: null,
      shared_with_project_ids: '[]',
      version: 1,
      availability: 'available',
      created_at: '2026-10-10T12:00:00Z',
      updated_at: '2026-10-10T12:00:00Z'
    });

    repo.saveRevision(store.connection, {
      id: 'rev-r-1',
      note_id: 'note-route-1',
      content: '# Route Test\nTesting fastify knowledge routes.',
      hash: activeHash,
      state: 'active',
      status: 'approved',
      created_at: '2026-10-10T12:00:00Z',
      approved_at: '2026-10-10T12:00:00Z',
      origin: 'vault-import',
      parent_revision_id: null
    });

    repo.saveRevision(store.connection, {
      id: 'rev-r-2',
      note_id: 'note-route-1',
      content: '# Route Test Cand\nCandidate content.',
      hash: candidateHash,
      state: 'candidate',
      status: 'unreviewed',
      created_at: '2026-10-10T12:00:00Z',
      approved_at: null,
      origin: 'vault-import',
      parent_revision_id: 'rev-r-1'
    });

    repo.saveCandidate(store.connection, {
      id: 'cand-route-1',
      revision_id: 'rev-r-2',
      version: 1,
      expected_source_hash: candidateHash,
      state: 'pending',
      processing: 'ready',
      created_at: '2026-10-10T12:00:00Z',
      updated_at: '2026-10-10T12:00:00Z'
    });

    repo.upsertFts(
      store.connection,
      'note-route-1',
      'rev-r-1',
      'Route Test Note',
      '# Route Test\nTesting fastify knowledge routes.'
    );
  });

  afterEach(async () => {
    await app.close();
    store.close();
    fs.rmSync(vaultRoot, { recursive: true, force: true });
  });

  it('GET /v1/knowledge returns search results', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/knowledge?column=active'
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.ok).toBe(true);
    expect(body.value.items.length).toBe(1);
    expect(body.value.items[0].id).toBe('note-route-1');
  });

  it('POST /v1/commands/approveCandidate approves pending candidate', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/commands/approveCandidate',
      payload: {
        requestId: 'req-1',
        idempotencyKey: 'idem-1',
        payload: {
          candidateId: 'cand-route-1',
          candidateVersion: 1,
          expectedSourceHash: candidateHash
        }
      }
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.ok).toBe(true);
    expect(body.value.activeRevisionId).toBe('rev-r-2');
  });

  it('POST /v1/commands/rejectCandidate rejects pending candidate', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/commands/rejectCandidate',
      payload: {
        requestId: 'req-2',
        idempotencyKey: 'idem-2',
        payload: {
          candidateId: 'cand-route-1',
          candidateVersion: 1,
          expectedSourceHash: candidateHash
        }
      }
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.ok).toBe(true);
    expect(body.value.activeRevisionId).toBe('rev-r-1');
  });

  it('POST /v1/commands/deactivateNote deactivates note', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/commands/deactivateNote',
      payload: {
        requestId: 'req-3',
        idempotencyKey: 'idem-3',
        payload: {
          noteId: 'note-route-1',
          expectedVersion: 1
        }
      }
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.ok).toBe(true);

    const ftsCheck = repo.searchFts(store.connection, 'Route');
    expect(ftsCheck.length).toBe(0);
  });

  it('POST /v1/commands/shareNote shares note with project IDs', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/commands/shareNote',
      payload: {
        requestId: 'req-4',
        idempotencyKey: 'idem-4',
        payload: {
          noteId: 'note-route-1',
          expectedVersion: 1,
          expectedActiveHash: activeHash,
          projectIds: ['proj-target-1']
        }
      }
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.ok).toBe(true);
    expect(body.value.sharedWithProjectIds).toEqual(['proj-target-1']);
  });

  it('POST /v1/commands/captureNote captures note via ingestion service', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/commands/captureNote',
      payload: {
        requestId: 'req-cap-1',
        idempotencyKey: 'idem-cap-1',
        payload: {
          vaultId: 'vault-1',
          path: 'notes/doc.md'
        }
      }
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.ok).toBe(true);
    expect(body.value.note.id).toBe('note-cap-1');
  });

  it('POST /v1/commands/rescanVault rescans vault via ingestion service', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/commands/rescanVault',
      payload: {
        requestId: 'req-rescan-1',
        idempotencyKey: 'idem-rescan-1',
        payload: {
          vaultId: 'vault-1'
        }
      }
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.ok).toBe(true);
    expect(body.value.captured).toBe(2);
  });
});
