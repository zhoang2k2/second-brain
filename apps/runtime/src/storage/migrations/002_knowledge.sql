-- Migration 002: Knowledge schema for notes, revisions, candidates, promotions, topics, links and FTS5 search
CREATE TABLE IF NOT EXISTS notes (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  path TEXT NOT NULL UNIQUE,
  current_revision_id TEXT,
  scope_kind TEXT NOT NULL,
  scope_project_id TEXT,
  shared_with_project_ids TEXT NOT NULL DEFAULT '[]',
  version INTEGER NOT NULL DEFAULT 1,
  availability TEXT NOT NULL DEFAULT 'available',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS revisions (
  id TEXT PRIMARY KEY,
  note_id TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  hash TEXT NOT NULL,
  state TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  approved_at TEXT,
  origin TEXT,
  parent_revision_id TEXT,
  UNIQUE (note_id, hash)
);

CREATE TABLE IF NOT EXISTS candidates (
  id TEXT PRIMARY KEY,
  revision_id TEXT NOT NULL UNIQUE REFERENCES revisions(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  expected_source_hash TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'pending',
  processing TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS promotions (
  id TEXT PRIMARY KEY,
  candidate_id TEXT NOT NULL REFERENCES candidates(id),
  note_id TEXT NOT NULL REFERENCES notes(id),
  revision_id TEXT NOT NULL REFERENCES revisions(id),
  source_hash TEXT NOT NULL,
  stage TEXT NOT NULL,
  error TEXT,
  created_at TEXT NOT NULL,
  completed_at TEXT
);

CREATE TABLE IF NOT EXISTS topics (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS note_links (
  id TEXT PRIMARY KEY,
  source_note_id TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  target_note_id TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE VIRTUAL TABLE IF NOT EXISTS notes_fts USING fts5(
  note_id UNINDEXED,
  revision_id UNINDEXED,
  title,
  content,
  tokenize = 'porter unicode61'
);
