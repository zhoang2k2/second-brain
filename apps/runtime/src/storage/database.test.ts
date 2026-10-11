import { it, expect } from 'vitest';
import { mkdtempSync, symlinkSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { openStore } from './database';

it('database_symlink_cannot_bypass_single_owner', () => {
  const root = mkdtempSync(join(tmpdir(), 'zhon-store-owner-'));
  const store = openStore(join(root, 'state.db'));
  let second: ReturnType<typeof openStore> | undefined;
  try {
    symlinkSync(join(root, 'state.db'), join(root, 'alias.db'));
    expect(() => { second = openStore(join(root, 'alias.db')); }).toThrow(/second runtime owner/);
  } finally {
    second?.close();
    store.close();
    rmSync(root, { recursive: true, force: true });
  }
});

it('migration_002_creates_knowledge_tables_and_fts', () => {
  const root = mkdtempSync(join(tmpdir(), 'zhon-store-migration-'));
  const store = openStore(join(root, 'state.db'));
  try {
    const tables = store.connection.prepare(
      "SELECT name FROM sqlite_master WHERE type='table'"
    ).all() as { name: string }[];
    const names = new Set(tables.map(t => t.name));
    expect(names.has('notes')).toBe(true);
    expect(names.has('revisions')).toBe(true);
    expect(names.has('candidates')).toBe(true);
    expect(names.has('promotions')).toBe(true);
    expect(names.has('topics')).toBe(true);
    expect(names.has('note_links')).toBe(true);
    expect(names.has('notes_fts')).toBe(true);

    // Verify unique constraint on (note_id, hash)
    store.connection.prepare(
      "INSERT INTO notes (id, title, path, scope_kind, created_at, updated_at) VALUES ('n1', 'Title', 'path/to/note.md', 'global', '2026-10-10T00:00:00Z', '2026-10-10T00:00:00Z')"
    ).run();

    store.connection.prepare(
      "INSERT INTO revisions (id, note_id, content, hash, state, status, created_at) VALUES ('r1', 'n1', 'content', 'hash-1', 'active', 'approved', '2026-10-10T00:00:00Z')"
    ).run();

    // Duplicate hash for same note must throw
    expect(() => {
      store.connection.prepare(
        "INSERT INTO revisions (id, note_id, content, hash, state, status, created_at) VALUES ('r2', 'n1', 'content2', 'hash-1', 'candidate', 'unreviewed', '2026-10-10T00:00:00Z')"
      ).run();
    }).toThrow();

    // Verify unique candidate per source revision
    store.connection.prepare(
      "INSERT INTO candidates (id, revision_id, version, expected_source_hash, created_at, updated_at) VALUES ('c1', 'r1', 1, 'hash-1', '2026-10-10T00:00:00Z', '2026-10-10T00:00:00Z')"
    ).run();

    expect(() => {
      store.connection.prepare(
        "INSERT INTO candidates (id, revision_id, version, expected_source_hash, created_at, updated_at) VALUES ('c2', 'r1', 2, 'hash-1', '2026-10-10T00:00:00Z', '2026-10-10T00:00:00Z')"
      ).run();
    }).toThrow();

    // Verify FTS5 insert and search
    store.connection.prepare(
      "INSERT INTO notes_fts (note_id, revision_id, title, content) VALUES ('n1', 'r1', 'Searchable Architecture', 'Zhon knowledge retrieval with exact revisions')"
    ).run();

    const ftsResults = store.connection.prepare(
      "SELECT note_id, revision_id FROM notes_fts WHERE notes_fts MATCH 'retrieval'"
    ).all() as { note_id: string; revision_id: string }[];
    expect(ftsResults.length).toBe(1);
    expect(ftsResults[0].note_id).toBe('n1');
    expect(ftsResults[0].revision_id).toBe('r1');
  } finally {
    store.close();
    rmSync(root, { recursive: true, force: true });
  }
});
