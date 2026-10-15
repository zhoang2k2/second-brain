import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, mkdirSync, readFileSync, realpathSync, renameSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createServer } from '../../apps/runtime/src/server/create-server';
import { openStore } from '../../apps/runtime/src/storage/database';
import { RegisteredRootPolicy } from '../../apps/runtime/src/adapters/filesystem/registered-paths';
import { KnowledgeRepository } from '../../apps/runtime/src/modules/knowledge/repository';
import { RevisionStore } from '../../apps/runtime/src/modules/knowledge/revision-store';
import { KnowledgeIngestionService, parseFrontmatter } from '../../apps/runtime/src/modules/knowledge/ingestion';
import { KnowledgeReviewService } from '../../apps/runtime/src/modules/knowledge/review';
import { KnowledgeRetrievalService } from '../../apps/runtime/src/modules/knowledge/retrieval';
import { reconcilePromotions } from '../../apps/runtime/src/modules/knowledge/promotion';

const cleanups: Array<() => Promise<void>> = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
});

function fixture() {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'zhon-p1-ready-')));
  const vault = join(root, 'vault');
  mkdirSync(vault);
  const store = openStore(join(root, 'state.db'));
  const repo = new KnowledgeRepository();
  const policy = new RegisteredRootPolicy([root]);
  const revisionsDir = join(root, 'revisions');
  const revisionStore = new RevisionStore({ revisionsDir });
  const ingestion = new KnowledgeIngestionService({ store, repo, policy, revisionStore });
  const review = new KnowledgeReviewService({ store, repo, revisionStore });
  const retrieval = new KnowledgeRetrievalService({ store, repo });
  store.connection.prepare('INSERT INTO vaults VALUES (?, ?, 1, ?)').run('vault-1', vault, new Date().toISOString());
  cleanups.push(async () => { store.close(); rmSync(root, { recursive: true, force: true }); });
  const start = async () => {
    const app = await createServer({
      store, clock: () => new Date().toISOString(), registeredRootPolicy: policy,
      localSessionConfig: { requireSession: false, allowedOrigins: ['http://127.0.0.1:3000'] },
      revisionsDir,
    });
    await app.ready();
    cleanups.push(async () => { await app.close(); });
    return app;
  };
  const capture = async (content = '# Original approved lesson', file = 'note.md') => {
    writeFileSync(join(vault, file), content);
    const result = await ingestion.captureNote({ vaultId: 'vault-1', path: file });
    if (!result.ok) throw new Error(result.error.code);
    return result.value;
  };
  const approve = (captured: Awaited<ReturnType<typeof capture>>) => review.approveCandidate({
    candidateId: captured.candidate.id, candidateVersion: captured.candidate.version,
    expectedSourceHash: captured.candidate.expectedSourceHash,
  });
  return { root, vault, store, repo, revisionStore, ingestion, review, retrieval, capture, approve, start };
}

describe('P1 readiness for P2 uses actual source boundaries', () => {
  it('duplicate source IDs block both captures and approval of a previously captured Candidate', async () => {
    const f = fixture();
    const original = await f.capture('---\nzhon_id: duplicated\n---\n# Original');
    writeFileSync(join(f.vault, 'duplicate.md'), '---\nzhon_id: duplicated\n---\n# Duplicate');
    expect((await f.ingestion.captureNote({ vaultId: 'vault-1', path: 'duplicate.md' })).ok).toBe(false);
    expect((await f.approve(original)).ok).toBe(false);
    expect(f.repo.findNoteById(f.store.connection, original.note.id)?.current_revision_id).toBeNull();
    unlinkSync(join(f.vault, 'duplicate.md'));
    expect((await f.approve(original)).ok).toBe(true);
  });

  it('same-path identity changes cannot silently replace the stored identity', async () => {
    const f = fixture();
    const original = await f.capture('---\nzhon_id: original\n---\n# Original');
    writeFileSync(join(f.vault, 'note.md'), '---\nzhon_id: replacement\n---\n# Replacement');
    expect((await f.ingestion.captureNote({ vaultId: 'vault-1', path: 'note.md' })).ok).toBe(false);
    expect(f.repo.listNotes(f.store.connection).map(note => note.id)).toEqual([original.note.id]);
  });

  it('duplicate IDs exclude prior Active retrieval until the source ambiguity is resolved', async () => {
    const f = fixture();
    const original = await f.capture('---\nzhon_id: duplicate-active\n---\n# Original');
    await f.approve(original);
    writeFileSync(join(f.vault, 'duplicate.md'), '---\nzhon_id: duplicate-active\n---\n# Duplicate');
    expect(await f.retrieval.retrieveActive({ scope: { kind: 'global' } })).toEqual([]);
    unlinkSync(join(f.vault, 'duplicate.md'));
    await f.ingestion.rescanVault('vault-1');
    expect((await f.retrieval.retrieveActive({ scope: { kind: 'global' } }))[0].revisionId).toBe(original.revision.id);
  });

  it('an oversized duplicate body still blocks an existing source identity', async () => {
    const f = fixture();
    const original = await f.capture('---\nzhon_id: large-duplicate\n---\n# Original');
    writeFileSync(join(f.vault, 'duplicate.md'), '---\nzhon_id: large-duplicate\n---\n' + 'x'.repeat(1048576));
    expect((await f.approve(original)).ok).toBe(false);
  });

  it('transaction abort after pointer mutation restores the old Active, pending Candidate, receipt and event state', async () => {
    const f = fixture();
    const original = await f.capture();
    await f.approve(original);
    const replacement = await f.capture('# Replacement');
    const input = { candidateId: replacement.candidate.id, candidateVersion: replacement.candidate.version, expectedSourceHash: replacement.candidate.expectedSourceHash };
    vi.spyOn(f.repo, 'upsertFts').mockImplementationOnce(() => { throw new Error('Interrupted after pointer update'); });
    const outcome = await f.review.approveCandidate(input, { requestId: 'abort-review', idempotencyKey: 'abort-review', payload: input });
    expect(outcome.ok).toBe(false);
    expect(f.repo.findNoteById(f.store.connection, original.note.id)?.current_revision_id).toBe(original.revision.id);
    expect(f.repo.findCandidateById(f.store.connection, replacement.candidate.id)?.state).toBe('pending');
    expect(f.store.connection.prepare("SELECT COUNT(*) AS count FROM processed_commands WHERE idempotency_key = 'abort-review'").get()).toEqual({ count: 0 });
    expect(f.store.connection.prepare("SELECT COUNT(*) AS count FROM events WHERE type = 'knowledge.candidate_approved'").get()).toEqual({ count: 1 });
    expect(readFileSync(join(f.vault, 'note.md'), 'utf8')).toBe('# Replacement');
    expect((await f.retrieval.retrieveActive({ scope: { kind: 'global' } }))[0].revisionId).toBe(original.revision.id);
  });

  it('startup cannot complete a journal pointing at corrupted revision bytes', async () => {
    const f = fixture();
    const original = await f.capture();
    await f.approve(original);
    f.repo.savePromotion(f.store.connection, { id: 'corrupt-promotion', candidate_id: original.candidate.id, note_id: original.note.id,
      revision_id: original.revision.id, source_hash: original.revision.contentHash, stage: 'started', error: null,
      created_at: new Date().toISOString(), completed_at: null });
    f.store.connection.prepare('UPDATE revisions SET content = ? WHERE id = ?').run('# Corrupt', original.revision.id);
    const outcome = await reconcilePromotions(f.store, f.repo, undefined, f.revisionStore);
    expect(outcome.completed).toBe(0);
    expect(outcome.blocked).toBe(1);
    expect(f.repo.findPromotionById(f.store.connection, 'corrupt-promotion')?.stage).toBe('blocked');
  });

  it.each(['zhon_id: "unterminated', 'zhon_id: first\nzhon_id: second', 'title: [unfinished', 'zhon_id: ""', 'zhon_id: stable: invalid', 'zhon_id: "bad\\q"'])('malformed flat properties cannot create a valid revision: %s', async properties => {
    const f = fixture();
    const content = `---\n${properties}\n---\n# Broken metadata`;
    expect(parseFrontmatter(content).ok).toBe(false);
    writeFileSync(join(f.vault, 'broken.md'), content);
    expect((await f.ingestion.captureNote({ vaultId: 'vault-1', path: 'broken.md' })).ok).toBe(false);
  });

  it('flat scalar comments and quotes resolve to the same identity', async () => {
    const f = fixture();
    const original = await f.capture('---\nzhon_id: quoted-id\n---\n# Original');
    writeFileSync(join(f.vault, 'duplicate.md'), '---\nzhon_id: quoted-id # comment\n---\n# Duplicate');
    expect((await f.approve(original)).ok).toBe(false);
    expect(parseFrontmatter('---\nzhon_id: "quoted-id"\n---\n# Test').frontmatter.zhon_id).toBe('quoted-id');
  });

  it('a newer stable save moves obsolete pending Candidates into history', async () => {
    const f = fixture();
    const old = await f.capture('# First draft');
    const current = await f.capture('# Second draft');
    const page = await f.retrieval.searchKnowledge({ scope: { kind: 'global' }, column: 'candidate' });
    expect(page.ok && page.value.items.map(item => item.id)).toEqual([current.candidate.id]);
    expect(f.repo.findCandidateById(f.store.connection, old.candidate.id)?.state).toBe('stale');
  });

  it.each(['database bytes', 'missing snapshot', 'corrupted snapshot'])('approval refuses %s without changing Active state or publishing an approval event', async failure => {
    const f = fixture();
    const old = await f.capture();
    await f.approve(old);
    const replacement = await f.capture('# Replacement');
    if (failure === 'database bytes') f.store.connection.prepare('UPDATE revisions SET content = ? WHERE id = ?').run('# Corrupt', replacement.revision.id);
    if (failure === 'missing snapshot') unlinkSync(f.revisionStore.getSnapshotPath(replacement.revision.contentHash));
    if (failure === 'corrupted snapshot') writeFileSync(f.revisionStore.getSnapshotPath(replacement.revision.contentHash), '# Corrupt');
    expect((await f.approve(replacement)).ok).toBe(false);
    expect(f.repo.findNoteById(f.store.connection, old.note.id)?.current_revision_id).toBe(old.revision.id);
    expect(f.store.connection.prepare("SELECT COUNT(*) AS count FROM events WHERE type = 'knowledge.candidate_approved'").get()).toEqual({ count: 1 });
  });

  it('rollback refuses corrupted approved bytes and preserves the current Active revision', async () => {
    const f = fixture();
    const old = await f.capture();
    await f.approve(old);
    const replacement = await f.capture('# Replacement');
    const active = await f.approve(replacement);
    if (!active.ok) throw new Error('Approval failed');
    f.store.connection.prepare('UPDATE revisions SET content = ? WHERE id = ?').run('# Corrupt', old.revision.id);
    expect((await f.review.rollbackNote({ noteId: old.note.id, revisionId: old.revision.id, expectedVersion: active.value.version })).ok).toBe(false);
    expect(f.repo.findNoteById(f.store.connection, old.note.id)?.current_revision_id).toBe(replacement.revision.id);
  });

  it('deactivated search matches approved body content', async () => {
    const f = fixture();
    const captured = await f.capture('# Ordinary title\nbody-only-keyword');
    const active = await f.approve(captured);
    if (!active.ok) throw new Error('Approval failed');
    await f.review.deactivateNote({ noteId: captured.note.id, expectedVersion: active.value.version });
    const page = await f.retrieval.searchKnowledge({ scope: { kind: 'global' }, column: 'deactivated', text: 'body-only-keyword' });
    expect(page.ok && page.value.items).toHaveLength(1);
  });

  it('watcher source deletion and invalid save publish a refresh event and safe diagnostic', async () => {
    const f = fixture();
    const captured = await f.capture();
    await f.approve(captured);
    await f.start();
    unlinkSync(join(f.vault, 'note.md'));
    await vi.waitFor(() => {
      expect(f.store.connection.prepare("SELECT COUNT(*) AS count FROM events WHERE type = 'knowledge.note_updated'").get()).toMatchObject({ count: 1 });
    });
    writeFileSync(join(f.vault, 'broken.md'), '---\nzhon_id: "unfinished\n---\n# Broken');
    await vi.waitFor(() => {
      const rows = f.store.connection.prepare("SELECT payload FROM events WHERE type = 'knowledge.note_updated'").all();
      expect(JSON.stringify(rows)).toContain('INCOMPLETE_YAML');
    });
  });

  it('startup discovers existing Markdown without direct ingestion', async () => {
    const f = fixture();
    writeFileSync(join(f.vault, 'existing.md'), '# Existing file');
    const app = await f.start();
    const response = await app.inject('/v1/knowledge?column=candidate');
    expect(response.json().value.items).toHaveLength(1);
    expect(response.json().value.items[0].path).toBe('existing.md');
  });

  it('startup captures offline edits while retaining the exact old Active revision', async () => {
    const f = fixture();
    const old = await f.capture();
    expect((await f.approve(old)).ok).toBe(true);
    writeFileSync(join(f.vault, 'note.md'), '# Replacement awaiting approval');
    const app = await f.start();
    expect((await app.inject('/v1/knowledge?column=candidate')).json().value.items).toHaveLength(1);
    const hits = await f.retrieval.retrieveActive({ scope: { kind: 'global' } });
    expect(hits[0].revisionId).toBe(old.revision.id);
    expect(hits[0].excerpt).toContain('Original approved lesson');
  });

  it('startup excludes a source deleted while offline', async () => {
    const f = fixture();
    const old = await f.capture();
    await f.approve(old);
    unlinkSync(join(f.vault, 'note.md'));
    const app = await f.start();
    expect((await app.inject('/v1/knowledge?column=active')).json().value.items).toHaveLength(0);
    expect(await f.retrieval.retrieveActive({ scope: { kind: 'global' } })).toEqual([]);
    expect(f.repo.findRevisionById(f.store.connection, old.revision.id)).not.toBeNull();
  });

  it('missing source cannot promote a Candidate even before watcher delivery', async () => {
    const f = fixture();
    const captured = await f.capture();
    unlinkSync(join(f.vault, 'note.md'));
    const result = await f.approve(captured);
    expect(result.ok).toBe(false);
    expect(f.repo.findNoteById(f.store.connection, captured.note.id)?.current_revision_id).toBeNull();
  });

  it('symlink substitution cannot authorize approval or subsequent retrieval', async () => {
    const f = fixture();
    const captured = await f.capture();
    const outside = join(f.root, 'outside.md');
    writeFileSync(outside, readFileSync(join(f.vault, 'note.md')));
    unlinkSync(join(f.vault, 'note.md'));
    symlinkSync(outside, join(f.vault, 'note.md'));
    expect((await f.approve(captured)).ok).toBe(false);
  });

  it('retrieval excludes missing source immediately without a rescan helper', async () => {
    const f = fixture();
    const captured = await f.capture();
    await f.approve(captured);
    unlinkSync(join(f.vault, 'note.md'));
    expect(await f.retrieval.retrieveActive({ scope: { kind: 'global' } })).toEqual([]);
  });

  it('retrieval excludes a symlink escape without reading outside the vault', async () => {
    const f = fixture();
    const captured = await f.capture();
    await f.approve(captured);
    const outside = join(f.root, 'outside.md');
    writeFileSync(outside, '# Outside reference');
    unlinkSync(join(f.vault, 'note.md'));
    symlinkSync(outside, join(f.vault, 'note.md'));
    expect(await f.retrieval.retrieveActive({ scope: { kind: 'global' } })).toEqual([]);
  });

  it('MVP rejects a second distinct vault before notes can collide', async () => {
    const f = fixture();
    const secondVault = join(f.root, 'second');
    mkdirSync(secondVault);
    const app = await f.start();
    const response = await app.inject({
      method: 'POST', url: '/v1/commands/registerVault',
      payload: { requestId: 'second-vault', idempotencyKey: 'second-vault', payload: { root: secondVault } },
    });
    expect(response.json().ok).toBe(false);
    expect(response.json().error.code).toBe('VAULT_LIMIT');
    expect(f.store.connection.prepare('SELECT COUNT(*) AS count FROM vaults').get()).toEqual({ count: 1 });
  });

  it('an already ambiguous database is not silently started', async () => {
    const f = fixture();
    const secondVault = join(f.root, 'second');
    mkdirSync(secondVault);
    f.store.connection.prepare('INSERT INTO vaults VALUES (?, ?, 1, ?)').run('vault-2', secondVault, new Date().toISOString());
    let failure: Error | undefined;
    try { await f.start(); } catch (error) { failure = error as Error; }
    expect(failure?.message).toContain('multiple vaults');
  });

  it('unstable bytes never become an eligible Candidate', async () => {
    const f = fixture();
    const file = join(f.vault, 'partial.md');
    writeFileSync(file, '# Partial editor save');
    const capture = f.ingestion.captureNote({ vaultId: 'vault-1', path: 'partial.md' });
    const editorSave = new Promise<void>(resolve => {
      setTimeout(() => { writeFileSync(file, '# Completed editor save'); resolve(); }, 5);
    });
    const result = await capture;
    await editorSave;
    expect(result.ok).toBe(false);
    expect(f.store.connection.prepare('SELECT COUNT(*) AS count FROM candidates').get()).toEqual({ count: 0 });
  });

  it('snapshot failure cannot leave a reviewable Candidate in SQLite', async () => {
    const f = fixture();
    vi.spyOn(RevisionStore.prototype, 'writeRevisionSnapshot').mockRejectedValueOnce(new Error('disk full'));
    try {
      const result = await f.capture();
      expect(result).toBeUndefined();
    } catch (error) {
      expect(String(error)).toContain('SNAPSHOT_FAILED');
    } finally { vi.restoreAllMocks(); }
    expect(f.repo.listNotes(f.store.connection)).toEqual([]);
  });

  it('review commands persist one receipt and audit event across retries', async () => {
    const f = fixture();
    const captured = await f.capture();
    const app = await f.start();
    const command = {
      requestId: 'approve-retry', idempotencyKey: 'approve-retry',
      payload: { candidateId: captured.candidate.id, candidateVersion: captured.candidate.version, expectedSourceHash: captured.candidate.expectedSourceHash },
    };
    const first = (await app.inject({ method: 'POST', url: '/v1/commands/approveCandidate', payload: command })).json();
    const second = (await app.inject({ method: 'POST', url: '/v1/commands/approveCandidate', payload: command })).json();
    expect(first.ok).toBe(true);
    expect(second).toEqual(first);
    expect(f.store.connection.prepare("SELECT COUNT(*) AS count FROM events WHERE type = 'knowledge.candidate_approved'").get()).toEqual({ count: 1 });
    const conflict = (await app.inject({ method: 'POST', url: '/v1/commands/rejectCandidate', payload: command })).json();
    expect(conflict.error.code).toBe('IDEMPOTENCY_CONFLICT');
  });

  it('active read model includes exact snapshot bytes and hash after reload', async () => {
    const f = fixture();
    const captured = await f.capture();
    await f.approve(captured);
    const page = await f.retrieval.searchKnowledge({ scope: { kind: 'global' }, column: 'active' });
    expect(page.ok && page.value.items[0]).toMatchObject({ markdown: captured.revision.markdown, contentHash: captured.revision.contentHash });
  });

  it('mutation endpoints require a concrete expected note version', async () => {
    const f = fixture();
    const captured = await f.capture();
    await f.approve(captured);
    const app = await f.start();
    const response = await app.inject({ method: 'POST', url: '/v1/commands/deactivateNote', payload: {
      requestId: 'missing-version', idempotencyKey: 'missing-version', payload: { noteId: captured.note.id },
    } });
    expect(response.statusCode).toBe(400);
    expect((await f.retrieval.retrieveActive({ scope: { kind: 'global' } }))).toHaveLength(1);
  });

  it('rescan restores the old approved index after a missing file returns', async () => {
    const f = fixture();
    const captured = await f.capture();
    await f.approve(captured);
    unlinkSync(join(f.vault, 'note.md'));
    await f.retrieval.retrieveActive({ scope: { kind: 'global' } });
    writeFileSync(join(f.vault, 'note.md'), captured.revision.markdown);
    await f.ingestion.rescanVault('vault-1');
    expect(await f.retrieval.retrieveActive({ scope: { kind: 'global' }, text: 'Original' })).toHaveLength(1);
  });

  it('rejected Candidates remain accessible in separate review history', async () => {
    const f = fixture();
    const captured = await f.capture();
    await f.review.rejectCandidate({ candidateId: captured.candidate.id, candidateVersion: captured.candidate.version, expectedSourceHash: captured.candidate.expectedSourceHash });
    const app = await f.start();
    const history = (await app.inject('/v1/knowledge?column=history')).json();
    expect(history.value.items[0]).toMatchObject({ id: captured.candidate.id, state: 'rejected', markdown: captured.revision.markdown });
    expect((await app.inject('/v1/knowledge?column=candidate')).json().value.items).toEqual([]);
  });

  it('an explicit stable identity survives a rename without losing the old approved revision', async () => {
    const f = fixture();
    const captured = await f.capture('---\nzhon_id: stable-note\n---\n# Stable lesson');
    await f.approve(captured);
    renameSync(join(f.vault, 'note.md'), join(f.vault, 'renamed.md'));
    await f.ingestion.rescanVault('vault-1');
    const hits = await f.retrieval.retrieveActive({ scope: { kind: 'global' } });
    expect(hits[0]).toMatchObject({ noteId: 'stable-note', revisionId: captured.revision.id, sourcePath: 'renamed.md' });
    expect(f.repo.listNotes(f.store.connection)).toHaveLength(1);
  });

  it('P2 retrieval never returns bytes that disagree with the approved hash', async () => {
    const f = fixture();
    const captured = await f.capture();
    await f.approve(captured);
    f.store.connection.prepare('UPDATE revisions SET content = ? WHERE id = ?').run('# Corrupted bytes', captured.revision.id);
    expect(await f.retrieval.retrieveActive({ scope: { kind: 'global' } })).toEqual([]);
  });

  it('FTS bytes are not used as authoritative context excerpts', async () => {
    const f = fixture();
    const captured = await f.capture();
    await f.approve(captured);
    f.store.connection.prepare('UPDATE notes_fts SET content = ?').run('Original injected pending content');
    const hits = await f.retrieval.retrieveActive({ scope: { kind: 'global' }, text: 'Original' });
    expect(hits[0].excerpt).toBe('# Original approved lesson');
  });

  it('project context includes approved global knowledge', async () => {
    const f = fixture();
    const captured = await f.capture();
    await f.approve(captured);
    expect(await f.retrieval.retrieveActive({ scope: { kind: 'project', projectId: 'project-a' } })).toHaveLength(1);
  });

  it('relevance is ranked within scope before limiting context', async () => {
    const f = fixture();
    const low = await f.capture('# Background\nlesson ' + 'unrelated '.repeat(100), 'low.md');
    await f.approve(low);
    const high = await f.capture('# Lesson\nlesson lesson lesson lesson', 'high.md');
    await f.approve(high);
    const hits = await f.retrieval.retrieveActive({ scope: { kind: 'global' }, text: 'lesson', limit: 1 });
    expect(hits[0].noteId).toBe(high.note.id);
  });
});
