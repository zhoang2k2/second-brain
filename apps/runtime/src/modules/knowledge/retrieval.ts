import {
  Result,
  KnowledgePage,
  KnowledgeQuery,
  RetrievalHit,
  Scope,
  KnowledgeQuerySchema
} from '@zhon/contracts';
import { Store } from '../../storage/database';
import { KnowledgeRepository, toNoteView, toCandidateView, toScope } from './repository';
import { noteSource } from './source-access';
import { createHash } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';
import { validateSourceIdentity } from './source-identity';

function snapshotMatches(content: string, hash: string): boolean {
  return createHash('sha256').update(content, 'utf8').digest('hex') === hash;
}

export function sanitizeFts5Query(query: string): string {
  const tokens = query.match(/[a-zA-Z0-9_\-\u00C0-\u024F\u1E00-\u1EFF]+/g);
  if (!tokens || tokens.length === 0) return '';
  return tokens.map(t => `"${t.replace(/"/g, '""')}"*`).join(' ');
}

export function isScopeAllowed(
  noteScope: Scope,
  queryScope: Scope,
  sharedWithProjectIds: string[]
): boolean {
  if (queryScope.kind === 'global') {
    if (noteScope.kind === 'global') return true;
    return sharedWithProjectIds.includes('global');
  }

  // Project scope
  const targetProjectId = queryScope.projectId;
  if (noteScope.kind === 'global') return true;
  if (noteScope.kind === 'project' && noteScope.projectId === targetProjectId) {
    return true;
  }

  return sharedWithProjectIds.includes(targetProjectId);
}

export class KnowledgeRetrievalService {
  private store: Store;
  private repo: KnowledgeRepository;

  constructor(config: { store: Store; repo: KnowledgeRepository; clock?: () => string }) {
    this.store = config.store;
    this.repo = config.repo;
  }

  private refreshSourceAvailability(): void {
    for (const note of this.repo.listNotes(this.store.connection)) {
      const source = noteSource(this.store.connection, note.path);
      if (!source.ok) {
        this.repo.updateNoteAvailability(this.store.connection, note.id, source.availability, new Date().toISOString());
        this.repo.deleteFts(this.store.connection, note.id);
        continue;
      }
      try {
        if (statSync(source.path).size > 1048576) continue;
        const identity = validateSourceIdentity(this.store.connection, note.path, readFileSync(source.path, 'utf8'), note.id);
        if (!identity.ok && ['DUPLICATE_NOTE_ID', 'IDENTITY_CHANGED', 'IDENTITY_UNVERIFIED'].includes(identity.error.code)) {
          this.repo.updateNoteAvailability(this.store.connection, note.id, 'unsafe', new Date().toISOString());
          this.repo.deleteFts(this.store.connection, note.id);
        }
      } catch {
        this.repo.updateNoteAvailability(this.store.connection, note.id, 'missing', new Date().toISOString());
        this.repo.deleteFts(this.store.connection, note.id);
      }
    }
  }

  async retrieveActive(input: { scope: Scope; text?: string; limit?: number }): Promise<RetrievalHit[]> {
    if (!KnowledgeQuerySchema.safeParse({ ...input, column: 'active' }).success) return [];
    this.refreshSourceAvailability();
    const db = this.store.connection;
    const limit = input.limit ?? 50;

    const notes = this.repo.listNotes(db).filter(n => n.current_revision_id && n.availability === 'available');

    // 1. Scope filter FIRST
    const allowedNotes = notes.filter(n => {
      let shared: string[] = [];
      try {
        shared = JSON.parse(n.shared_with_project_ids);
      } catch {
        shared = [];
      }
      return isScopeAllowed(toScope(n), input.scope, shared);
    });

    if (allowedNotes.length === 0) return [];

    // 2. FTS match if text is provided
    let matchedNoteIds: Map<string, string> | null = null;
    if (input.text && input.text.trim().length > 0) {
      const sanitized = sanitizeFts5Query(input.text);
      if (!sanitized) return [];
      const ftsHits = this.repo.searchFts(db, sanitized, allowedNotes.map(note => note.id));
      matchedNoteIds = new Map();
      for (const hit of ftsHits) {
        matchedNoteIds.set(hit.note_id, hit.content);
      }
      const rank = new Map(ftsHits.map((hit, index) => [hit.note_id, index]));
      allowedNotes.sort((left, right) => (rank.get(left.id) ?? Infinity) - (rank.get(right.id) ?? Infinity));
    }

    const hits: RetrievalHit[] = [];

    for (const note of allowedNotes) {
      if (matchedNoteIds !== null && !matchedNoteIds.has(note.id)) {
        continue;
      }

      const rev = this.repo.findRevisionById(db, note.current_revision_id!);
      if (!rev || rev.state !== 'active' || rev.status !== 'approved' || !snapshotMatches(rev.content, rev.hash)) {
        continue;
      }

      let excerpt = '';
      // FTS selects identities, never authoritative excerpt bytes.
      const fullContent = rev.content;
      if (input.text && input.text.trim().length > 0) {
        // Excerpt around match
        const idx = fullContent.toLowerCase().indexOf(input.text.toLowerCase().trim());
        if (idx !== -1) {
          const start = Math.max(0, idx - 40);
          const end = Math.min(fullContent.length, idx + 100);
          excerpt = (start > 0 ? '...' : '') + fullContent.slice(start, end).replace(/\n+/g, ' ') + (end < fullContent.length ? '...' : '');
        } else {
          excerpt = fullContent.slice(0, 150).replace(/\n+/g, ' ');
        }
      } else {
        excerpt = fullContent.slice(0, 150).replace(/\n+/g, ' ');
      }

      hits.push({
        noteId: note.id,
        revisionId: rev.id,
        excerpt,
        scope: toScope(note),
        sourcePath: note.path,
        contentHash: rev.hash
      });

      if (hits.length >= limit) break;
    }

    return hits;
  }

  async searchKnowledge(query: KnowledgeQuery): Promise<Result<KnowledgePage>> {
    const parseResult = KnowledgeQuerySchema.safeParse(query);
    if (!parseResult.success) {
      return {
        ok: false,
        error: { code: 'INVALID_QUERY', message: 'Query validation failed', retryable: false }
      };
    }

    this.refreshSourceAvailability();

    const db = this.store.connection;
    const limit = query.limit ?? 50;

    if (query.column === 'active') {
      const notes = this.repo.listNotes(db).filter(n => n.current_revision_id && n.availability === 'available');

      const allowed = notes.filter(n => {
        let shared: string[] = [];
        try {
          shared = JSON.parse(n.shared_with_project_ids);
        } catch {
          shared = [];
        }
        return isScopeAllowed(toScope(n), query.scope, shared);
      });

      let matchedIds: Set<string> | null = null;
      if (query.text && query.text.trim().length > 0) {
        const sanitized = sanitizeFts5Query(query.text);
        if (!sanitized) {
          return { ok: true, value: { items: [], total: 0 } };
        }
        const fts = this.repo.searchFts(db, sanitized, allowed.map(note => note.id));
        matchedIds = new Set(fts.map(f => f.note_id));
        const rank = new Map(fts.map((hit, index) => [hit.note_id, index]));
        allowed.sort((left, right) => (rank.get(left.id) ?? Infinity) - (rank.get(right.id) ?? Infinity));
      }

      const activeItems = [];
      for (const n of allowed) {
        if (matchedIds && !matchedIds.has(n.id)) continue;
        const rev = this.repo.findRevisionById(db, n.current_revision_id!);
        if (rev && rev.state === 'active' && rev.status === 'approved' && snapshotMatches(rev.content, rev.hash)) {
          activeItems.push({ ...toNoteView(n), markdown: rev.content, contentHash: rev.hash });
          if (activeItems.length >= limit) break;
        }
      }

      return {
        ok: true,
        value: {
          items: activeItems,
          total: activeItems.length
        }
      };
    }

    if (query.column === 'candidate' || query.column === 'history') {
      const pendingCandidates = query.column === 'history'
        ? this.repo.listCandidates(db).filter(candidate => candidate.state !== 'pending')
        : this.repo.listCandidates(db, 'pending');
      const candidateItems = [];

      for (const cand of pendingCandidates) {
        const rev = this.repo.findRevisionById(db, cand.revision_id);
        if (!rev) continue;
        const note = this.repo.findNoteById(db, rev.note_id);
        if (!note || (query.column !== 'history' && note.availability !== 'available')) continue;

        let shared: string[] = [];
        try {
          shared = JSON.parse(note.shared_with_project_ids);
        } catch {
          shared = [];
        }

        if (!isScopeAllowed(toScope(note), query.scope, shared)) {
          continue;
        }

        if (query.text && query.text.trim().length > 0) {
          const lowerText = query.text.toLowerCase().trim();
        const matchesTitle = note.title.toLowerCase().includes(lowerText) || note.path.toLowerCase().includes(lowerText);
          const matchesContent = rev.content.toLowerCase().includes(lowerText);
          if (!matchesTitle && !matchesContent) continue;
        }

        const links = this.repo.findLinksBySourceNoteId(db, note.id);
        const prevRev = note.current_revision_id
          ? this.repo.findRevisionById(db, note.current_revision_id)
          : null;
        candidateItems.push(
          toCandidateView(cand, links, {
            noteId: note.id,
            title: note.title,
            path: note.path,
            markdown: rev.content,
            previousMarkdown: prevRev?.content
          })
        );
        if (candidateItems.length >= limit) break;
      }

      return {
        ok: true,
        value: {
          items: candidateItems,
          total: candidateItems.length
        }
      };
    }

    if (query.column === 'deactivated') {
      const notes = this.repo.listNotes(db);
      const deactivatedNotes = notes.filter(n => {
        if (n.availability !== 'available') return true;
        if (n.current_revision_id) {
          const rev = this.repo.findRevisionById(db, n.current_revision_id);
          return rev?.state === 'deactive';
        }
        return false;
      });

      const allowed = deactivatedNotes.filter(n => {
        let shared: string[] = [];
        try {
          shared = JSON.parse(n.shared_with_project_ids);
        } catch {
          shared = [];
        }
        return isScopeAllowed(toScope(n), query.scope, shared);
      });

      let matchedIds: Set<string> | null = null;
      if (query.text && query.text.trim().length > 0) {
        const lower = query.text.toLowerCase().trim();
        matchedIds = new Set(allowed.filter(n => {
          const revision = n.current_revision_id ? this.repo.findRevisionById(db, n.current_revision_id) : null;
          return n.title.toLowerCase().includes(lower) || n.path.toLowerCase().includes(lower) || Boolean(revision?.content.toLowerCase().includes(lower));
        }).map(n => n.id));
      }

      const items = [];
      for (const n of allowed) {
        if (matchedIds && !matchedIds.has(n.id)) continue;
        const revision = n.current_revision_id ? this.repo.findRevisionById(db, n.current_revision_id) : null;
        items.push({ ...toNoteView(n), markdown: revision?.content, contentHash: revision?.hash });
        if (items.length >= limit) break;
      }

      return {
        ok: true,
        value: {
          items,
          total: items.length
        }
      };
    }

    return { ok: true, value: { items: [], total: 0 } };
  }
}
