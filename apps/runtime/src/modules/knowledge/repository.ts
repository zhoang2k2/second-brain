import type Database from 'better-sqlite3';
import {
  NoteView,
  RevisionView,
  CandidateView,
  NoteAvailability,
  CandidateState,
  CandidateProcessing,
  RevisionState,
  ReviewStatus,
  Scope
} from '@zhon/contracts';

export interface NoteRecord {
  id: string;
  title: string;
  path: string;
  current_revision_id: string | null;
  scope_kind: string;
  scope_project_id: string | null;
  shared_with_project_ids: string; // JSON string
  version: number;
  availability: string;
  created_at: string;
  updated_at: string;
}

export interface RevisionRecord {
  id: string;
  note_id: string;
  content: string;
  hash: string;
  state: string;
  status: string;
  created_at: string;
  approved_at: string | null;
  origin: string | null;
  parent_revision_id: string | null;
}

export interface CandidateRecord {
  id: string;
  revision_id: string;
  version: number;
  expected_source_hash: string;
  state: string;
  processing: string;
  created_at: string;
  updated_at: string;
}

export interface PromotionRecord {
  id: string;
  candidate_id: string;
  note_id: string;
  revision_id: string;
  source_hash: string;
  stage: string;
  error: string | null;
  created_at: string;
  completed_at: string | null;
}

export interface NoteLinkRecord {
  id: string;
  source_note_id: string;
  target_note_id: string;
  label: string;
  created_at: string;
}

export function toScope(record: { scope_kind: string; scope_project_id: string | null }): Scope {
  if (record.scope_kind === 'project' && record.scope_project_id) {
    return { kind: 'project', projectId: record.scope_project_id };
  }
  return { kind: 'global' };
}

export function toNoteView(record: NoteRecord): NoteView {
  let shared: string[] = [];
  try {
    shared = JSON.parse(record.shared_with_project_ids);
  } catch {
    shared = [];
  }

  const result: NoteView = {
    id: record.id,
    title: record.title,
    path: record.path,
    scope: toScope(record),
    version: record.version,
    availability: record.availability as NoteAvailability,
    sharedWithProjectIds: shared
  };
  if (record.current_revision_id) {
    result.activeRevisionId = record.current_revision_id;
  }
  return result;
}

export function toRevisionView(record: RevisionRecord): RevisionView {
  const result: RevisionView = {
    id: record.id,
    noteId: record.note_id,
    contentHash: record.hash,
    markdown: record.content
  };
  if (record.origin) result.origin = record.origin;
  if (record.parent_revision_id) result.parentRevisionId = record.parent_revision_id;
  return result;
}

export function toCandidateView(
  record: CandidateRecord,
  proposedLinks: Array<{ sourceNoteId: string; targetNoteId: string; label: string }> = [],
  metadata?: {
    noteId?: string;
    title?: string;
    path?: string;
    markdown?: string;
    previousMarkdown?: string;
  }
): CandidateView {
  return {
    id: record.id,
    revisionId: record.revision_id,
    version: record.version,
    expectedSourceHash: record.expected_source_hash,
    state: record.state as CandidateState,
    processing: record.processing as CandidateProcessing,
    proposedLinks,
    ...(metadata?.noteId ? { noteId: metadata.noteId } : {}),
    ...(metadata?.title ? { title: metadata.title } : {}),
    ...(metadata?.path ? { path: metadata.path } : {}),
    ...(metadata?.markdown ? { markdown: metadata.markdown } : {}),
    ...(metadata?.previousMarkdown ? { previousMarkdown: metadata.previousMarkdown } : {})
  };
}

export class KnowledgeRepository {
  // Notes
  saveNote(db: Database.Database, note: NoteRecord): void {
    const stmt = db.prepare(`
      INSERT INTO notes (
        id, title, path, current_revision_id, scope_kind, scope_project_id,
        shared_with_project_ids, version, availability, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        title = excluded.title,
        path = excluded.path,
        current_revision_id = excluded.current_revision_id,
        scope_kind = excluded.scope_kind,
        scope_project_id = excluded.scope_project_id,
        shared_with_project_ids = excluded.shared_with_project_ids,
        version = excluded.version,
        availability = excluded.availability,
        updated_at = excluded.updated_at
    `);
    stmt.run(
      note.id,
      note.title,
      note.path,
      note.current_revision_id,
      note.scope_kind,
      note.scope_project_id,
      note.shared_with_project_ids,
      note.version,
      note.availability,
      note.created_at,
      note.updated_at
    );
  }

  findNoteById(db: Database.Database, id: string): NoteRecord | null {
    const stmt = db.prepare('SELECT * FROM notes WHERE id = ?');
    const row = stmt.get(id) as NoteRecord | undefined;
    return row ?? null;
  }

  findNoteByPath(db: Database.Database, path: string): NoteRecord | null {
    const stmt = db.prepare('SELECT * FROM notes WHERE path = ?');
    const row = stmt.get(path) as NoteRecord | undefined;
    return row ?? null;
  }

  listNotes(db: Database.Database): NoteRecord[] {
    const stmt = db.prepare('SELECT * FROM notes ORDER BY created_at ASC');
    return stmt.all() as NoteRecord[];
  }

  updateNoteActiveRevision(
    db: Database.Database,
    noteId: string,
    revisionId: string,
    newVersion: number,
    updatedAt: string
  ): void {
    const stmt = db.prepare(`
      UPDATE notes
      SET current_revision_id = ?, version = ?, updated_at = ?
      WHERE id = ?
    `);
    stmt.run(revisionId, newVersion, updatedAt, noteId);
  }

  updateNoteAvailability(
    db: Database.Database,
    noteId: string,
    availability: string,
    updatedAt: string
  ): void {
    const stmt = db.prepare('UPDATE notes SET availability = ?, updated_at = ? WHERE id = ?');
    stmt.run(availability, updatedAt, noteId);
  }

  updateNoteSharing(
    db: Database.Database,
    noteId: string,
    sharedWithProjectIds: string[],
    newVersion: number,
    updatedAt: string
  ): void {
    const stmt = db.prepare(`
      UPDATE notes
      SET shared_with_project_ids = ?, version = ?, updated_at = ?
      WHERE id = ?
    `);
    stmt.run(JSON.stringify(sharedWithProjectIds), newVersion, updatedAt, noteId);
  }

  // Revisions
  saveRevision(db: Database.Database, rev: RevisionRecord): void {
    const stmt = db.prepare(`
      INSERT INTO revisions (
        id, note_id, content, hash, state, status,
        created_at, approved_at, origin, parent_revision_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(note_id, hash) DO UPDATE SET
        state = excluded.state,
        status = excluded.status,
        approved_at = excluded.approved_at
    `);
    stmt.run(
      rev.id,
      rev.note_id,
      rev.content,
      rev.hash,
      rev.state,
      rev.status,
      rev.created_at,
      rev.approved_at,
      rev.origin,
      rev.parent_revision_id
    );
  }

  findRevisionById(db: Database.Database, id: string): RevisionRecord | null {
    const stmt = db.prepare('SELECT * FROM revisions WHERE id = ?');
    const row = stmt.get(id) as RevisionRecord | undefined;
    return row ?? null;
  }

  findRevisionByNoteAndHash(db: Database.Database, noteId: string, hash: string): RevisionRecord | null {
    const stmt = db.prepare('SELECT * FROM revisions WHERE note_id = ? AND hash = ?');
    const row = stmt.get(noteId, hash) as RevisionRecord | undefined;
    return row ?? null;
  }

  listRevisionsByNoteId(db: Database.Database, noteId: string): RevisionRecord[] {
    const stmt = db.prepare('SELECT * FROM revisions WHERE note_id = ? ORDER BY created_at ASC');
    return stmt.all(noteId) as RevisionRecord[];
  }

  updateRevisionStatus(
    db: Database.Database,
    revisionId: string,
    state: RevisionState,
    status: ReviewStatus,
    approvedAt: string | null = null
  ): void {
    const stmt = db.prepare(`
      UPDATE revisions
      SET state = ?, status = ?, approved_at = ?
      WHERE id = ?
    `);
    stmt.run(state, status, approvedAt, revisionId);
  }

  // Candidates
  saveCandidate(db: Database.Database, candidate: CandidateRecord): void {
    const stmt = db.prepare(`
      INSERT INTO candidates (
        id, revision_id, version, expected_source_hash, state, processing, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(revision_id) DO UPDATE SET
        state = excluded.state,
        processing = excluded.processing,
        updated_at = excluded.updated_at
    `);
    stmt.run(
      candidate.id,
      candidate.revision_id,
      candidate.version,
      candidate.expected_source_hash,
      candidate.state,
      candidate.processing,
      candidate.created_at,
      candidate.updated_at
    );
  }

  findCandidateById(db: Database.Database, id: string): CandidateRecord | null {
    const stmt = db.prepare('SELECT * FROM candidates WHERE id = ?');
    const row = stmt.get(id) as CandidateRecord | undefined;
    return row ?? null;
  }

  findCandidateByRevisionId(db: Database.Database, revisionId: string): CandidateRecord | null {
    const stmt = db.prepare('SELECT * FROM candidates WHERE revision_id = ?');
    const row = stmt.get(revisionId) as CandidateRecord | undefined;
    return row ?? null;
  }

  findPendingCandidateByNoteId(db: Database.Database, noteId: string): CandidateRecord | null {
    const stmt = db.prepare(`
      SELECT c.* FROM candidates c
      JOIN revisions r ON c.revision_id = r.id
      WHERE r.note_id = ? AND c.state = 'pending'
      ORDER BY c.created_at DESC LIMIT 1
    `);
    const row = stmt.get(noteId) as CandidateRecord | undefined;
    return row ?? null;
  }

  listCandidates(db: Database.Database, state?: string): CandidateRecord[] {
    if (state) {
      const stmt = db.prepare('SELECT * FROM candidates WHERE state = ? ORDER BY created_at DESC');
      return stmt.all(state) as CandidateRecord[];
    }
    const stmt = db.prepare('SELECT * FROM candidates ORDER BY created_at DESC');
    return stmt.all() as CandidateRecord[];
  }

  countCandidates(db: Database.Database, state?: string): number {
    if (state) {
      const stmt = db.prepare('SELECT COUNT(*) as count FROM candidates WHERE state = ?');
      const row = stmt.get(state) as { count: number };
      return row.count;
    }
    const stmt = db.prepare('SELECT COUNT(*) as count FROM candidates');
    const row = stmt.get() as { count: number };
    return row.count;
  }

  updateCandidateState(
    db: Database.Database,
    id: string,
    state: CandidateState,
    updatedAt: string,
    processing?: CandidateProcessing
  ): void {
    if (processing) {
      const stmt = db.prepare(`
        UPDATE candidates
        SET state = ?, processing = ?, updated_at = ?
        WHERE id = ?
      `);
      stmt.run(state, processing, updatedAt, id);
    } else {
      const stmt = db.prepare(`
        UPDATE candidates
        SET state = ?, updated_at = ?
        WHERE id = ?
      `);
      stmt.run(state, updatedAt, id);
    }
  }

  // Links
  saveNoteLink(db: Database.Database, link: NoteLinkRecord): void {
    const stmt = db.prepare(`
      INSERT INTO note_links (id, source_note_id, target_note_id, label, created_at)
      VALUES (?, ?, ?, ?, ?)
    `);
    stmt.run(link.id, link.source_note_id, link.target_note_id, link.label, link.created_at);
  }

  findLinksBySourceNoteId(
    db: Database.Database,
    sourceNoteId: string
  ): Array<{ sourceNoteId: string; targetNoteId: string; label: string }> {
    const stmt = db.prepare('SELECT source_note_id, target_note_id, label FROM note_links WHERE source_note_id = ?');
    const rows = stmt.all(sourceNoteId) as Array<{ source_note_id: string; target_note_id: string; label: string }>;
    return rows.map(r => ({
      sourceNoteId: r.source_note_id,
      targetNoteId: r.target_note_id,
      label: r.label
    }));
  }

  // Promotions (Journal)
  savePromotion(db: Database.Database, promo: PromotionRecord): void {
    const stmt = db.prepare(`
      INSERT INTO promotions (
        id, candidate_id, note_id, revision_id, source_hash, stage, error, created_at, completed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      promo.id,
      promo.candidate_id,
      promo.note_id,
      promo.revision_id,
      promo.source_hash,
      promo.stage,
      promo.error,
      promo.created_at,
      promo.completed_at
    );
  }

  updatePromotion(
    db: Database.Database,
    id: string,
    stage: string,
    error: string | null = null,
    completedAt: string | null = null
  ): void {
    const stmt = db.prepare(`
      UPDATE promotions
      SET stage = ?, error = ?, completed_at = ?
      WHERE id = ?
    `);
    stmt.run(stage, error, completedAt, id);
  }

  findPendingPromotions(db: Database.Database): PromotionRecord[] {
    const stmt = db.prepare(`
      SELECT * FROM promotions
      WHERE completed_at IS NULL AND stage != 'completed'
    `);
    return stmt.all() as PromotionRecord[];
  }

  findPromotionById(db: Database.Database, id: string): PromotionRecord | null {
    const stmt = db.prepare('SELECT * FROM promotions WHERE id = ?');
    const row = stmt.get(id) as PromotionRecord | undefined;
    return row ?? null;
  }

  // FTS5
  upsertFts(
    db: Database.Database,
    noteId: string,
    revisionId: string,
    title: string,
    content: string
  ): void {
    db.prepare('DELETE FROM notes_fts WHERE note_id = ?').run(noteId);
    db.prepare(`
      INSERT INTO notes_fts (note_id, revision_id, title, content)
      VALUES (?, ?, ?, ?)
    `).run(noteId, revisionId, title, content);
  }

  deleteFts(db: Database.Database, noteId: string): void {
    db.prepare('DELETE FROM notes_fts WHERE note_id = ?').run(noteId);
  }

  searchFts(
    db: Database.Database,
    sanitizedQuery: string,
    eligibleNoteIds?: string[]
  ): Array<{ note_id: string; revision_id: string; title: string; content: string }> {
    if (!sanitizedQuery) return [];
    if (eligibleNoteIds && eligibleNoteIds.length === 0) return [];
    try {
      const stmt = db.prepare(`
        SELECT note_id, revision_id, title, content
        FROM notes_fts
        WHERE notes_fts MATCH ?
        ${eligibleNoteIds ? `AND note_id IN (${eligibleNoteIds.map(() => '?').join(',')})` : ''}
        ORDER BY rank, note_id
      `);
      return stmt.all(sanitizedQuery, ...(eligibleNoteIds ?? [])) as Array<{ note_id: string; revision_id: string; title: string; content: string }>;
    } catch {
      return [];
    }
  }
}
