import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NoteView, RevisionView, CandidateView } from '@zhon/contracts';
import { openStore, Store } from '../../storage/database';
import { RegisteredRootPolicy } from '../../adapters/filesystem/registered-paths';
import { RevisionStore } from './revision-store';
import { KnowledgeRepository } from './repository';
import { KnowledgeIngestionService } from './ingestion';
import { VaultWatcher } from '../../adapters/filesystem/vault-watcher';

export interface TestCaptureResult {
  ok: boolean;
  value: { note: NoteView; revision: RevisionView; candidate: CandidateView };
  error: { code: string; message: string; retryable: boolean };
}

interface IngestionTestFixture {
  store: Store;
  vaultId: string;
  vaultRoot: string;
  revisionsRoot: string;
  outsideRoot: string;
  ingestion: KnowledgeIngestionService;
  capture(relPath: string): Promise<TestCaptureResult>;
  candidateCount(): Promise<number>;
  writeVaultNote(relPath: string, content: string): void;
  cleanup(): void;
}

function createTestFixture(): IngestionTestFixture {
  const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zhon-ingest-fixture-'));
  const vaultRoot = path.join(baseDir, 'vault');
  const revisionsRoot = path.join(baseDir, 'revisions');
  const outsideRoot = path.join(baseDir, 'outside');
  fs.mkdirSync(vaultRoot, { recursive: true });
  fs.mkdirSync(revisionsRoot, { recursive: true });
  fs.mkdirSync(outsideRoot, { recursive: true });

  const store = openStore(':memory:');
  const vaultId = 'vault-test-1';
  store.connection.prepare(
    'INSERT INTO vaults (id, root, version, created_at) VALUES (?, ?, ?, ?)'
  ).run(vaultId, fs.realpathSync(vaultRoot), 1, new Date().toISOString());

  const policy = new RegisteredRootPolicy([vaultRoot]);
  const revisionStore = new RevisionStore({ revisionsDir: revisionsRoot });
  const repo = new KnowledgeRepository();
  const ingestion = new KnowledgeIngestionService({
    store,
    repo,
    revisionStore,
    policy,
    clock: () => new Date().toISOString()
  });

  return {
    store,
    vaultId,
    vaultRoot,
    revisionsRoot,
    outsideRoot,
    ingestion,
    writeVaultNote(relPath: string, content: string) {
      const target = path.join(vaultRoot, relPath);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, content, 'utf8');
    },
    async capture(relPath: string) {
      return (await ingestion.captureNote({ vaultId, path: relPath })) as unknown as TestCaptureResult;
    },
    async candidateCount() {
      const row = store.connection.prepare('SELECT COUNT(*) as count FROM candidates').get() as { count: number };
      return row.count;
    },
    cleanup() {
      store.close();
      fs.rmSync(baseDir, { recursive: true, force: true });
    }
  };
}

describe('Knowledge Ingestion and Identity (P1-T2)', () => {
  let fixture: IngestionTestFixture;

  beforeEach(() => {
    fixture = createTestFixture();
  });

  afterEach(() => {
    fixture.cleanup();
  });

  it('stable_save_creates_candidate and repeated_bytes_deduplicate with escape denied', async () => {
    // 1. Stable save creates candidate
    fixture.writeVaultNote('note.md', '# Initial Title\nFirst revision content.');
    const first = await fixture.capture('note.md');

    expect(first.ok).toBe(true);
    expect(first.value.note).toBeDefined();
    expect(first.value.revision).toBeDefined();
    expect(first.value.candidate).toBeDefined();
    expect(first.value.note.version).toBe(1);
    expect(first.value.note.availability).toBe('available');
    expect(first.value.candidate.state).toBe('pending');
    expect(await fixture.candidateCount()).toBe(1);

    // 2. Repeated bytes deduplicate
    const second = await fixture.capture('note.md');
    expect(second.ok).toBe(true);
    expect(second.value.revision.id).toBe(first.value.revision.id);
    expect(await fixture.candidateCount()).toBe(1);

    // 3. Symlink escape denied
    const outsideFile = path.join(fixture.outsideRoot, 'outside.md');
    fs.writeFileSync(outsideFile, '# Outside\nSensitive outside note.', 'utf8');
    fs.symlinkSync(outsideFile, path.join(fixture.vaultRoot, 'escape.md'));

    const escapeResult = await fixture.capture('escape.md');
    expect(escapeResult.ok).toBe(false);
    expect(escapeResult.error.code).toBe('PATH_OUT_OF_SCOPE');
  });

  it('incomplete_yaml_blocked', async () => {
    // Unclosed frontmatter delimiter
    fixture.writeVaultNote('unclosed.md', '---\nzhon_id: note-1\ntitle: Broken Note\n# No closing delimiter\nSome text');
    const resultUnclosed = await fixture.capture('unclosed.md');
    expect(resultUnclosed.ok).toBe(false);
    expect(resultUnclosed.error.code).toBe('INCOMPLETE_YAML');

    // Malformed YAML content
    fixture.writeVaultNote('malformed.md', '---\n: invalid yaml syntax\n---\n# Content');
    const resultMalformed = await fixture.capture('malformed.md');
    expect(resultMalformed.ok).toBe(false);
    expect(resultMalformed.error.code).toBe('INCOMPLETE_YAML');
  });

  it('duplicate_ids_flagged', async () => {
    fixture.writeVaultNote('doc1.md', '---\nzhon_id: fixed-id-123\n---\n# Doc 1');
    const first = await fixture.capture('doc1.md');
    expect(first.ok).toBe(true);

    // Second file in vault claiming same zhon_id
    fixture.writeVaultNote('doc2.md', '---\nzhon_id: fixed-id-123\n---\n# Doc 2');
    const second = await fixture.capture('doc2.md');
    expect(second.ok).toBe(false);
    expect(second.error.code).toBe('DUPLICATE_NOTE_ID');
  });

  it('ambiguous_rename_flagged', async () => {
    // Note without zhon_id captured at pathA
    fixture.writeVaultNote('pathA.md', '# Ambiguous Test\nIdentical content for rename check.');
    const first = await fixture.capture('pathA.md');
    expect(first.ok).toBe(true);

    // Remove pathA from disk
    fs.unlinkSync(path.join(fixture.vaultRoot, 'pathA.md'));

    // Two new files created with the exact same content without zhon_id
    fixture.writeVaultNote('pathB.md', '# Ambiguous Test\nIdentical content for rename check.');
    fixture.writeVaultNote('pathC.md', '# Ambiguous Test\nIdentical content for rename check.');

    // Capturing when multiple new files match missing note without zhon_id flags AMBIGUOUS_RENAME
    const rescanResult = await fixture.ingestion.rescanVault(fixture.vaultId);
    expect(rescanResult.blocked).toBeGreaterThan(0);

    const directCapture = await fixture.capture('pathB.md');
    // Direct capture of pathB treats as ambiguous rename or separate provisional note without overwriting pathA's identity
    expect(directCapture.ok).toBe(true);
    expect(directCapture.value.note.id).not.toBe(first.value.note.id);
  });

  it('symlink_escape_denied', async () => {
    // Path traversal forbidden
    const traversalResult = await fixture.capture('../vault/note.md');
    expect(traversalResult.ok).toBe(false);
    expect(traversalResult.error.code).toBe('PATH_OUT_OF_SCOPE');

    // Symlink pointing outside vault forbidden
    const outsideSecret = path.join(fixture.outsideRoot, 'secret.md');
    fs.writeFileSync(outsideSecret, 'secret', 'utf8');
    fs.symlinkSync(outsideSecret, path.join(fixture.vaultRoot, 'symlink-leak.md'));

    const leakResult = await fixture.capture('symlink-leak.md');
    expect(leakResult.ok).toBe(false);
    expect(leakResult.error.code).toBe('PATH_OUT_OF_SCOPE');
  });

  it('deleted_source_excluded', async () => {
    fixture.writeVaultNote('ephemeral.md', '# Ephemeral Note\nWill be deleted.');
    const captured = await fixture.capture('ephemeral.md');
    expect(captured.ok).toBe(true);

    // Source is deleted
    fs.unlinkSync(path.join(fixture.vaultRoot, 'ephemeral.md'));

    // Capture or rescan marks note as missing
    const rescan = await fixture.ingestion.rescanVault(fixture.vaultId);
    expect(rescan.captured).toBe(0);

    const checkNote = fixture.store.connection.prepare(
      'SELECT availability FROM notes WHERE id = ?'
    ).get(captured.value.note.id) as { availability: string };
    expect(checkNote.availability).toBe('missing');
  });

  it('startup_rescan_finds_missed_change', async () => {
    fixture.writeVaultNote('lesson.md', '# Lesson 1\nInitial lesson content.');
    const initial = await fixture.capture('lesson.md');
    expect(initial.ok).toBe(true);

    // Promote candidate to active so note has active revision
    fixture.store.connection.prepare(
      "UPDATE revisions SET state = 'active', status = 'approved' WHERE id = ?"
    ).run(initial.value.revision.id);
    fixture.store.connection.prepare(
      'UPDATE notes SET current_revision_id = ? WHERE id = ?'
    ).run(initial.value.revision.id, initial.value.note.id);
    fixture.store.connection.prepare(
      "UPDATE candidates SET state = 'approved' WHERE id = ?"
    ).run(initial.value.candidate.id);

    // Offline manual edit directly on filesystem
    fixture.writeVaultNote('lesson.md', '# Lesson 1\nUpdated lesson content offline.');

    // Runtime startup rescan
    const rescan = await fixture.ingestion.rescanVault(fixture.vaultId);
    expect(rescan.captured).toBe(1);

    // A new candidate was created for the changed content
    const candidates = fixture.store.connection.prepare(
      "SELECT id, state FROM candidates WHERE state = 'pending'"
    ).all() as Array<{ id: string; state: string }>;
    expect(candidates.length).toBe(1);
  });

  it('cap_individual_source_at_1_mib_rejects_with_note_too_large', async () => {
    const largeContent = 'A'.repeat(1024 * 1024 + 10); // > 1 MiB
    fixture.writeVaultNote('large.md', largeContent);

    const result = await fixture.capture('large.md');
    expect(result.ok).toBe(false);
    expect(result.error.code).toBe('NOTE_TOO_LARGE');
  });

  it('debounce_rapid_writes_using_fake_timers', async () => {
    vi.useFakeTimers();
    try {
      const callback = vi.fn();
      const watcher = new VaultWatcher({
        vaultRoot: fixture.vaultRoot,
        debounceMs: 100,
        onChange: callback
      });
      watcher.start();

      // Trigger rapid events within debounce window
      watcher.notifyChange('note.md');
      watcher.notifyChange('note.md');
      watcher.notifyChange('note.md');

      expect(callback).not.toHaveBeenCalled();

      // Advance time beyond debounce window
      vi.advanceTimersByTime(150);
      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith('note.md');

      watcher.close();
    } finally {
      vi.useRealTimers();
    }
  });
});
