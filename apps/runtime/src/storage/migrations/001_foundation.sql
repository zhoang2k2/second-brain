-- Migration 001: Foundation schema for projects and vaults
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  root TEXT NOT NULL UNIQUE,
  remote TEXT,
  version INTEGER NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS vaults (
  id TEXT PRIMARY KEY,
  root TEXT NOT NULL UNIQUE,
  version INTEGER NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS events (
  sequence INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  occurred_at TEXT NOT NULL,
  payload TEXT NOT NULL
);
