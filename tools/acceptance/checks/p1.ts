import { registerCheck } from '../registry';
import {
  ReviewInputSchema,
  ShareInputSchema,
  NoteViewSchema,
  CandidateViewSchema
} from '@zhon/contracts';
import { openStore } from '../../../apps/runtime/src/storage/database';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import assert from 'node:assert/strict';
import { createServer } from '../../../apps/runtime/src/server/create-server';
import { LocalSessionManager } from '../../../apps/runtime/src/server/local-session';
import { RegisteredRootPolicy } from '../../../apps/runtime/src/adapters/filesystem/registered-paths';
import { KnowledgeRetrievalService } from '../../../apps/runtime/src/modules/knowledge/retrieval';
import { KnowledgeRepository } from '../../../apps/runtime/src/modules/knowledge/repository';
import type { FastifyInstance } from 'fastify';
import type { Store } from '../../../apps/runtime/src/storage/database';

registerCheck('P1', 'real_runtime_knowledge_lifecycle', async () => {
  const name = 'real_runtime_knowledge_lifecycle';
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'zhon-p1-runtime-')));
  const vault = path.join(root, 'vault');
  fs.mkdirSync(vault);
  const dbPath = path.join(root, 'state.db');
  let store: Store | undefined;
  let server: FastifyInstance | undefined;
  let sessionId = '';
  const start = async () => {
    store = openStore(dbPath);
    const manager = new LocalSessionManager({ requireSession: true, allowedOrigins: ['http://127.0.0.1:3000'] });
    server = await createServer({ store, clock: () => new Date().toISOString(),
      registeredRootPolicy: new RegisteredRootPolicy([root]), sessionManager: manager,
      localSessionConfig: { requireSession: true, allowedOrigins: ['http://127.0.0.1:3000'] },
      revisionsDir: path.join(root, 'revisions'),
    });
    await server.ready();
    const session = manager.createLocalSession({ bootstrapCode: manager.generateBootstrapCode(), origin: 'http://127.0.0.1:3000' });
    assert.equal(session.ok, true);
    if (!session.ok) throw new Error('Bootstrap failed');
    sessionId = session.value.sessionId;
  };
  let commandNumber = 0;
  const command = async (action: string, payload: unknown) => {
    const id = `acceptance-${++commandNumber}`;
    const response = await server!.inject({ method: 'POST', url: `/v1/commands/${action}`,
      headers: { 'x-session-id': sessionId, origin: 'http://127.0.0.1:3000' },
      payload: { requestId: id, idempotencyKey: id, payload },
    });
    const body = response.json();
    assert.equal(body.ok, true, `${action}: ${JSON.stringify(body)}`);
    return body.value;
  };
  try {
    // Registration must discover existing notes; no direct ingestion helper.
    fs.writeFileSync(path.join(vault, 'lesson.md'), '# Accepted lesson\nExact approved context.');
    await start();
    const registered = await command('registerVault', { root: vault });
    const deadline = Date.now() + 5000;
    while (Date.now() < deadline) {
      const ready = (await server!.inject('/v1/knowledge?column=candidate')).json().value.items;
      if (ready.length) break;
      await new Promise(resolve => setTimeout(resolve, 25));
    }
    assert.ok(registered.id);
    const candidates = (await server!.inject('/v1/knowledge?column=candidate')).json().value.items;
    assert.equal(candidates.length, 1);
    const candidate = candidates[0];
    const active = await command('approveCandidate', { candidateId: candidate.id, candidateVersion: candidate.version, expectedSourceHash: candidate.expectedSourceHash });
    let retrieval = new KnowledgeRetrievalService({ store: store!, repo: new KnowledgeRepository() });
    const initial = await retrieval.retrieveActive({ scope: { kind: 'global' }, text: 'approved' });
    assert.equal(initial[0].revisionId, candidate.revisionId);
    assert.equal(initial[0].contentHash, candidate.expectedSourceHash);

    await server!.close(); server = undefined;
    store!.close(); store = undefined;
    fs.writeFileSync(path.join(vault, 'lesson.md'), '# Replacement\nPending, not approved context.');
    await start();
    retrieval = new KnowledgeRetrievalService({ store: store!, repo: new KnowledgeRepository() });
    assert.equal((await retrieval.retrieveActive({ scope: { kind: 'global' } }))[0].revisionId, candidate.revisionId);
    const replacement = (await server!.inject('/v1/knowledge?column=candidate')).json().value.items[0];
    assert.ok(replacement);
    await command('rejectCandidate', { candidateId: replacement.id, candidateVersion: replacement.version, expectedSourceHash: replacement.expectedSourceHash });
    assert.equal((await server!.inject('/v1/knowledge?column=candidate')).json().value.items.length, 0);
    await command('deactivateNote', { noteId: active.id, expectedVersion: active.version });
    assert.deepEqual(await retrieval.retrieveActive({ scope: { kind: 'global' } }), []);
    await command('rollbackNote', { noteId: active.id, revisionId: candidate.revisionId, expectedVersion: active.version + 1 });
    assert.equal((await retrieval.retrieveActive({ scope: { kind: 'global' } }))[0].revisionId, candidate.revisionId);
    fs.unlinkSync(path.join(vault, 'lesson.md'));
    assert.deepEqual(await retrieval.retrieveActive({ scope: { kind: 'global' } }), []);
    return { name, status: 'PASS' };
  } catch (error) {
    return { name, status: 'FAIL', reason: error instanceof Error ? error.message : String(error) };
  } finally {
    await server?.close();
    store?.close();
    fs.rmSync(root, { recursive: true, force: true });
  }
});

// 1. Contracts & Schema Gate
registerCheck('P1', 'knowledge_contracts_and_schema_check', async () => {
  try {
    const validReview = {
      candidateId: 'cand-1',
      candidateVersion: 1,
      expectedSourceHash: 'a1b2c3d4e5f60718293a4b5c6d7e8f90123456789abcdef0123456789abcdef0'
    };
    const parsed = ReviewInputSchema.safeParse(validReview);
    if (!parsed.success) {
      return { name: 'knowledge_contracts_and_schema_check', status: 'FAIL', reason: 'Valid ReviewInput failed schema' };
    }

    // Must reject missing hash or version
    const invalidReview = { candidateId: 'cand-1', candidateVersion: 1 };
    if (ReviewInputSchema.safeParse(invalidReview).success) {
      return { name: 'knowledge_contracts_and_schema_check', status: 'FAIL', reason: 'ReviewInput allowed missing expectedSourceHash' };
    }

    // Must reject malformed hash
    const badHashReview = { candidateId: 'cand-1', candidateVersion: 1, expectedSourceHash: 'not-a-sha256' };
    if (ReviewInputSchema.safeParse(badHashReview).success) {
      return { name: 'knowledge_contracts_and_schema_check', status: 'FAIL', reason: 'ReviewInput allowed non-hex 64-char hash' };
    }

    // ShareInput schema validation
    const validShare = {
      noteId: 'n1',
      expectedVersion: 1,
      expectedActiveHash: 'a1b2c3d4e5f60718293a4b5c6d7e8f90123456789abcdef0123456789abcdef0',
      projectIds: ['p2']
    };
    if (!ShareInputSchema.safeParse(validShare).success) {
      return { name: 'knowledge_contracts_and_schema_check', status: 'FAIL', reason: 'Valid ShareInput failed schema' };
    }

    // NoteViewSchema and CandidateViewSchema validation
    const validNoteView = {
      id: 'n1',
      title: 'Valid Note',
      path: 'notes/valid.md',
      scope: { kind: 'global' as const },
      version: 1,
      availability: 'available' as const,
      sharedWithProjectIds: []
    };
    if (!NoteViewSchema.safeParse(validNoteView).success) {
      return { name: 'knowledge_contracts_and_schema_check', status: 'FAIL', reason: 'Valid NoteView failed schema' };
    }

    const validCandidateView = {
      id: 'c1',
      noteId: 'n1',
      revisionId: 'r1',
      version: 1,
      expectedSourceHash: 'a1b2c3d4e5f60718293a4b5c6d7e8f90123456789abcdef0123456789abcdef0',
      state: 'pending' as const,
      processing: 'pending' as const,
      proposedLinks: []
    };
    if (!CandidateViewSchema.safeParse(validCandidateView).success) {
      return { name: 'knowledge_contracts_and_schema_check', status: 'FAIL', reason: 'Valid CandidateView failed schema' };
    }

    return { name: 'knowledge_contracts_and_schema_check', status: 'PASS' };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { name: 'knowledge_contracts_and_schema_check', status: 'FAIL', reason: msg };
  }
});

// 2. Storage, Migration 002 & FTS5 Gate
registerCheck('P1', 'knowledge_storage_and_fts_check', async () => {
  const migrationPath = path.resolve(process.cwd(), 'apps/runtime/src/storage/migrations/002_knowledge.sql');
  if (!fs.existsSync(migrationPath)) {
    return { name: 'knowledge_storage_and_fts_check', status: 'BLOCKED', reason: 'Missing 002_knowledge.sql migration' };
  }

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zhon-p1-acceptance-'));
  const dbPath = path.join(tempDir, 'p1.db');

  try {
    const store = openStore(dbPath);

    // Verify all tables exist
    const tables = store.connection.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as { name: string }[];
    const names = new Set(tables.map(t => t.name));
    for (const expected of ['notes', 'revisions', 'candidates', 'promotions', 'topics', 'note_links', 'notes_fts']) {
      if (!names.has(expected)) {
        store.close();
        fs.rmSync(tempDir, { recursive: true, force: true });
        return { name: 'knowledge_storage_and_fts_check', status: 'FAIL', reason: `Table ${expected} missing from database` };
      }
    }

    // Insert test note & revision
    store.connection.prepare(
      "INSERT INTO notes (id, title, path, scope_kind, shared_with_project_ids, created_at, updated_at) VALUES ('n1', 'Test', 'p.md', 'global', '[]', '2026-10-10T00:00:00Z', '2026-10-10T00:00:00Z')"
    ).run();

    store.connection.prepare(
      "INSERT INTO revisions (id, note_id, content, hash, state, status, created_at) VALUES ('r1', 'n1', 'searchable query content', 'hash-1', 'active', 'approved', '2026-10-10T00:00:00Z')"
    ).run();

    // Verify unique revision constraint (note_id, hash)
    let duplicateRejected = false;
    try {
      store.connection.prepare(
        "INSERT INTO revisions (id, note_id, content, hash, state, status, created_at) VALUES ('r2', 'n1', 'other', 'hash-1', 'candidate', 'unreviewed', '2026-10-10T00:00:00Z')"
      ).run();
    } catch {
      duplicateRejected = true;
    }

    if (!duplicateRejected) {
      store.close();
      fs.rmSync(tempDir, { recursive: true, force: true });
      return { name: 'knowledge_storage_and_fts_check', status: 'FAIL', reason: 'Duplicate revision hash for same note was allowed' };
    }

    // Verify FTS5 query
    store.connection.prepare(
      "INSERT INTO notes_fts (note_id, revision_id, title, content) VALUES ('n1', 'r1', 'Test', 'searchable query content')"
    ).run();

    const ftsHits = store.connection.prepare(
      "SELECT note_id FROM notes_fts WHERE notes_fts MATCH 'searchable'"
    ).all();
    if (ftsHits.length !== 1) {
      store.close();
      fs.rmSync(tempDir, { recursive: true, force: true });
      return { name: 'knowledge_storage_and_fts_check', status: 'FAIL', reason: 'FTS5 match query returned 0 hits' };
    }

    store.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
    return { name: 'knowledge_storage_and_fts_check', status: 'PASS' };
  } catch (err: unknown) {
    fs.rmSync(tempDir, { recursive: true, force: true });
    const msg = err instanceof Error ? err.message : String(err);
    return { name: 'knowledge_storage_and_fts_check', status: 'FAIL', reason: msg };
  }
});
