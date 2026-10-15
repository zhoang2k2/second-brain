import { Scope, Result, Command } from '@zhon/contracts';

export interface NoteView {
  id: string;
  path: string;
  title?: string;
  scope: Scope;
  version: number;
  availability: 'available' | 'missing' | 'unsafe';
  activeRevisionId?: string;
  contentHash?: string;
  markdown?: string;
  sharedWithProjectIds?: string[];
}

export interface RevisionView {
  id: string;
  noteId: string;
  contentHash: string;
  markdown: string;
  origin?: string;
  parentRevisionId?: string;
}

export interface NoteLink {
  sourceNoteId: string;
  targetNoteId: string;
  label: string;
}

export interface CandidateView {
  id: string;
  noteId?: string;
  revisionId: string;
  path?: string;
  title?: string;
  version: number;
  expectedSourceHash: string;
  state: 'pending' | 'approved' | 'rejected' | 'stale';
  processing: 'pending' | 'ready' | 'failed' | 'budgetBlocked';
  proposedLinks?: NoteLink[];
  markdown?: string;
  previousMarkdown?: string;
}

export interface KnowledgeQuery {
  scope?: Scope;
  text?: string;
  column?: 'active' | 'candidate' | 'deactivated' | 'history';
  limit?: number;
}

export interface KnowledgePage {
  items: Array<NoteView | CandidateView>;
  total: number;
}

export interface ReviewInput {
  candidateId: string;
  candidateVersion: number;
  expectedSourceHash: string;
}

export interface ShareInput {
  noteId: string;
  expectedVersion: number;
  expectedActiveHash: string;
  projectIds: string[];
}

export interface KnowledgeApiClient {
  command<T, U>(name: string, cmd: Command<T>): Promise<Result<U>>;
  query<T>(path: string): Promise<Result<T>>;
  searchKnowledge?(query: KnowledgeQuery): Promise<Result<KnowledgePage>>;
  approveCandidate?(input: ReviewInput): Promise<Result<NoteView>>;
  rejectCandidate?(input: ReviewInput): Promise<Result<NoteView>>;
  deactivateNote?(input: { noteId: string; expectedVersion: number }): Promise<Result<NoteView>>;
  rollbackNote?(input: { noteId: string; revisionId: string; expectedVersion: number }): Promise<Result<NoteView>>;
  shareNote?(input: ShareInput): Promise<Result<NoteView>>;
  subscribe?(after: number, onEvent: (event: { type: string; payload?: unknown }) => void): () => void;
}

export class KnowledgeService {
  constructor(private client?: KnowledgeApiClient) {}

  async searchKnowledge(query: KnowledgeQuery): Promise<Result<KnowledgePage>> {
    if (!this.client) {
      return {
        ok: false,
        error: { code: 'CLIENT_UNAVAILABLE', message: 'API client not available', retryable: false },
      };
    }
    if (this.client.searchKnowledge) {
      return this.client.searchKnowledge(query);
    }
    const params = new URLSearchParams();
    if (query.scope) {
      params.set('scope', JSON.stringify(query.scope));
    }
    if (query.text) params.set('text', query.text);
    if (query.column) params.set('column', query.column);
    if (query.limit) params.set('limit', String(query.limit));
    return this.client.query<KnowledgePage>(`knowledge?${params.toString()}`);
  }

  async approveCandidate(input: ReviewInput): Promise<Result<NoteView>> {
    if (!this.client) {
      return {
        ok: false,
        error: { code: 'CLIENT_UNAVAILABLE', message: 'API client not available', retryable: false },
      };
    }
    if (this.client.approveCandidate) {
      return this.client.approveCandidate(input);
    }
    return this.client.command<ReviewInput, NoteView>('approveCandidate', {
      requestId: `req-${Date.now()}`,
      idempotencyKey: `idem-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      payload: input,
    });
  }

  async rejectCandidate(input: ReviewInput): Promise<Result<NoteView>> {
    if (!this.client) {
      return {
        ok: false,
        error: { code: 'CLIENT_UNAVAILABLE', message: 'API client not available', retryable: false },
      };
    }
    if (this.client.rejectCandidate) {
      return this.client.rejectCandidate(input);
    }
    return this.client.command<ReviewInput, NoteView>('rejectCandidate', {
      requestId: `req-${Date.now()}`,
      idempotencyKey: `idem-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      payload: input,
    });
  }

  async deactivateNote(noteId: string, expectedVersion: number): Promise<Result<NoteView>> {
    if (!this.client) {
      return {
        ok: false,
        error: { code: 'CLIENT_UNAVAILABLE', message: 'API client not available', retryable: false },
      };
    }
    if (this.client.deactivateNote) {
      return this.client.deactivateNote({ noteId, expectedVersion });
    }
    return this.client.command<{ noteId: string; expectedVersion: number }, NoteView>('deactivateNote', {
      requestId: `req-${Date.now()}`,
      idempotencyKey: `idem-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      payload: { noteId, expectedVersion },
    });
  }

  async rollbackNote(noteId: string, revisionId: string, expectedVersion: number): Promise<Result<NoteView>> {
    if (!this.client) {
      return {
        ok: false,
        error: { code: 'CLIENT_UNAVAILABLE', message: 'API client not available', retryable: false },
      };
    }
    if (this.client.rollbackNote) {
      return this.client.rollbackNote({ noteId, revisionId, expectedVersion });
    }
    return this.client.command<{ noteId: string; revisionId: string; expectedVersion: number }, NoteView>('rollbackNote', {
      requestId: `req-${Date.now()}`,
      idempotencyKey: `idem-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      payload: { noteId, revisionId, expectedVersion },
    });
  }

  async shareNote(input: ShareInput): Promise<Result<NoteView>> {
    if (!this.client) {
      return {
        ok: false,
        error: { code: 'CLIENT_UNAVAILABLE', message: 'API client not available', retryable: false },
      };
    }
    if (this.client.shareNote) {
      return this.client.shareNote(input);
    }
    return this.client.command<ShareInput, NoteView>('shareNote', {
      requestId: `req-${Date.now()}`,
      idempotencyKey: `idem-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      payload: input,
    });
  }
}
