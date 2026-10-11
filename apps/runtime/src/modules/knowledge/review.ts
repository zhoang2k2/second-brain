import * as fs from 'node:fs';
import * as crypto from 'node:crypto';
import {
  Result,
  NoteView,
  ReviewInput,
  ShareInput,
  ReviewInputSchema,
  ShareInputSchema
} from '@zhon/contracts';
import type { Command, RuntimeEvent } from '@zhon/contracts';
import { Store } from '../../storage/database';
import { RevisionStore } from './revision-store';
import { KnowledgeRepository, toNoteView } from './repository';
import { noteSource } from './source-access';
import { validateSourceIdentity } from './source-identity';
import { EventStore } from '../../server/events';
import { ProjectRepository } from '../projects/repository';

export interface KnowledgeReviewServiceConfig {
  store: Store;
  repo: KnowledgeRepository;
  revisionStore?: RevisionStore;
  clock?: () => string;
  eventStore?: EventStore;
}

export class KnowledgeReviewService {
  private store: Store;
  private repo: KnowledgeRepository;
  private clock: () => string;
  private events: EventStore;
  private receipts = new ProjectRepository();
  private revisionStore?: RevisionStore;

  constructor(config: KnowledgeReviewServiceConfig) {
    this.store = config.store;
    this.repo = config.repo;
    this.clock = config.clock ?? (() => new Date().toISOString());
    this.events = config.eventStore ?? new EventStore();
    this.revisionStore = config.revisionStore;
  }

  private execute<T>(name: string, input: T, mutation: () => Result<NoteView>, command?: Command<T>): Result<NoteView> {
    const payloadHash = crypto.createHash('sha256').update(JSON.stringify(input)).digest('hex');
    let event: RuntimeEvent<unknown> | undefined;
    try {
      const result = this.store.transaction(() => {
        if (command) {
          const receipt = this.receipts.findProcessedCommand(this.store.connection, command.idempotencyKey);
          if (receipt) {
            if (receipt.commandName !== name || receipt.payloadHash !== payloadHash) {
              return { ok: false as const, error: { code: 'IDEMPOTENCY_CONFLICT', message: 'Command key was reused for a different action or payload.', retryable: false } };
            }
            return JSON.parse(receipt.result) as Result<NoteView>;
          }
        }
        const outcome = mutation();
        if (!outcome.ok) return outcome;
        const active = outcome.value.activeRevisionId
          ? this.repo.findRevisionById(this.store.connection, outcome.value.activeRevisionId) : null;
        if (active) outcome.value = { ...outcome.value, markdown: active.content, contentHash: active.hash };
        const eventTypes: Record<string, string> = {
          approveCandidate: 'knowledge.candidate_approved', rejectCandidate: 'knowledge.candidate_rejected',
          deactivateNote: 'knowledge.note_deactivated', rollbackNote: 'knowledge.note_updated', shareNote: 'knowledge.note_updated',
        };
        event = this.events.appendEvent(this.store.connection, {
          type: eventTypes[name], resourceId: outcome.value.id, occurredAt: this.clock(),
          payload: { action: name, note: outcome.value, requestId: command?.requestId },
        });
        if (command) this.receipts.saveProcessedCommand(this.store.connection, {
          idempotencyKey: command.idempotencyKey, requestId: command.requestId, commandName: name,
          payloadHash, result: JSON.stringify(outcome), createdAt: this.clock(),
        });
        return outcome;
      });
      if (event) this.events.publish(event);
      return result;
    } catch {
      return { ok: false, error: { code: 'TRANSACTION_FAILED', message: 'Knowledge update could not be persisted.', retryable: true } };
    }
  }

  async approveCandidate(input: ReviewInput, command?: Command<ReviewInput>): Promise<Result<NoteView>> {
    const parse = ReviewInputSchema.safeParse(input);
    if (!parse.success) {
      return {
        ok: false,
        error: { code: 'INVALID_INPUT', message: 'Invalid review input envelope', retryable: false }
      };
    }

    const now = this.clock();
    const db = this.store.connection;

    return this.execute('approveCandidate', input, () => {
      // 1. Fetch candidate
      const cand = this.repo.findCandidateById(db, input.candidateId);
      if (!cand || cand.state !== 'pending') {
        return {
          ok: false,
          error: {
            code: 'STALE_CANDIDATE',
            message: cand ? `Candidate is ${cand.state}` : 'Candidate not found',
            retryable: false
          }
        };
      }

      // 2. Exact version and hash check
      if (cand.version !== input.candidateVersion || cand.expected_source_hash !== input.expectedSourceHash) {
        return {
          ok: false,
          error: {
            code: 'STALE_CANDIDATE',
            message: 'Candidate version or hash does not match expected input',
            retryable: false
          }
        };
      }

      const rev = this.repo.findRevisionById(db, cand.revision_id);
      if (!rev) {
        return {
          ok: false,
          error: { code: 'REVISION_NOT_FOUND', message: 'Revision not found for candidate', retryable: false }
        };
      }

      if (rev.hash !== input.expectedSourceHash || !this.revisionStore?.matchesSnapshot(rev.content, rev.hash)) {
        return { ok: false, error: { code: 'SNAPSHOT_INTEGRITY', message: 'The captured revision is missing or damaged. Restore the immutable snapshot before review.', retryable: false } };
      }

      const note = this.repo.findNoteById(db, rev.note_id);
      if (!note) {
        return {
          ok: false,
          error: { code: 'NOTE_NOT_FOUND', message: 'Note not found for revision', retryable: false }
        };
      }

      // 3. Source CAS against disk file
      const source = noteSource(db, note.path);
      if (!source.ok) {
        this.repo.updateNoteAvailability(db, note.id, source.availability, now);
        this.repo.deleteFts(db, note.id);
        return { ok: false, error: { code: 'SOURCE_UNAVAILABLE', message: 'Source is missing or unsafe. Restore and rescan the registered vault before review.', retryable: false } };
      }
      {
          const currentDiskBytes = fs.readFileSync(source.path, 'utf8');
          const identity = validateSourceIdentity(db, note.path, currentDiskBytes, note.id);
          if (!identity.ok) return identity;
          const currentDiskHash = crypto.createHash('sha256').update(currentDiskBytes, 'utf8').digest('hex');
          if (currentDiskHash !== input.expectedSourceHash) {
            // Source file was edited since candidate capture -> preserve manual edit & refuse approval
            const promoId = `promo-${crypto.randomUUID()}`;
            this.repo.savePromotion(db, {
              id: promoId,
              candidate_id: cand.id,
              note_id: note.id,
              revision_id: rev.id,
              source_hash: input.expectedSourceHash,
              stage: 'failed',
              error: 'SOURCE_CHANGED',
              created_at: now,
              completed_at: now
            });
            this.repo.updateCandidateState(db, cand.id, 'stale', now);
            return {
              ok: false,
              error: {
                code: 'STALE_CANDIDATE',
                message: 'Source file on disk has changed since candidate was created',
                retryable: false
              }
            };
          }
      }

      // 4. Record promotion journal intent
      const promoId = `promo-${crypto.randomUUID()}`;
      this.repo.savePromotion(db, {
        id: promoId,
        candidate_id: cand.id,
        note_id: note.id,
        revision_id: rev.id,
        source_hash: input.expectedSourceHash,
        stage: 'started',
        error: null,
        created_at: now,
        completed_at: null
      });

      // 5. Update candidate
      this.repo.updateCandidateState(db, cand.id, 'approved', now, 'ready');

      // 6. Update revision
      this.repo.updateRevisionStatus(db, rev.id, 'active', 'approved', now);

      // 7. Swap active pointer and increment version
      const newVersion = note.version + 1;
      this.repo.updateNoteActiveRevision(db, note.id, rev.id, newVersion, now);
      note.current_revision_id = rev.id;
      note.version = newVersion;
      note.updated_at = now;

      // 8. Update FTS5 virtual table
      this.repo.upsertFts(db, note.id, rev.id, note.title, rev.content);

      // 9. Mark promotion completed
      this.repo.updatePromotion(db, promoId, 'completed', null, now);

      return {
        ok: true,
        value: toNoteView(note)
      };
    }, command);
  }

  async rejectCandidate(input: ReviewInput, command?: Command<ReviewInput>): Promise<Result<NoteView>> {
    const parse = ReviewInputSchema.safeParse(input);
    if (!parse.success) {
      return {
        ok: false,
        error: { code: 'INVALID_INPUT', message: 'Invalid review input envelope', retryable: false }
      };
    }

    const now = this.clock();
    const db = this.store.connection;

    return this.execute('rejectCandidate', input, () => {
      const cand = this.repo.findCandidateById(db, input.candidateId);
      if (!cand || cand.state !== 'pending') {
        return {
          ok: false,
          error: { code: 'STALE_CANDIDATE', message: 'Candidate not found or not pending', retryable: false }
        };
      }

      if (cand.version !== input.candidateVersion || cand.expected_source_hash !== input.expectedSourceHash) {
        return {
          ok: false,
          error: { code: 'STALE_CANDIDATE', message: 'Candidate version or hash mismatch', retryable: false }
        };
      }

      const rev = this.repo.findRevisionById(db, cand.revision_id);
      if (!rev) {
        return {
          ok: false,
          error: { code: 'REVISION_NOT_FOUND', message: 'Revision not found for candidate', retryable: false }
        };
      }

      const note = this.repo.findNoteById(db, rev.note_id);
      if (!note) {
        return {
          ok: false,
          error: { code: 'NOTE_NOT_FOUND', message: 'Note not found', retryable: false }
        };
      }

      // Mark candidate rejected and revision rejected; note active pointer is preserved!
      this.repo.updateCandidateState(db, cand.id, 'rejected', now);
      this.repo.updateRevisionStatus(db, rev.id, 'candidate', 'rejected', null);

      return {
        ok: true,
        value: toNoteView(note)
      };
    }, command);
  }

  async deactivateNote(input: { noteId: string; expectedVersion: number }, command?: Command<typeof input>): Promise<Result<NoteView>> {
    const now = this.clock();
    const db = this.store.connection;

    return this.execute('deactivateNote', input, () => {
      const note = this.repo.findNoteById(db, input.noteId);
      if (!note) {
        return {
          ok: false,
          error: { code: 'NOTE_NOT_FOUND', message: `Note not found: ${input.noteId}`, retryable: false }
        };
      }

      if (input.expectedVersion !== undefined && note.version !== input.expectedVersion) {
        return {
          ok: false,
          error: { code: 'VERSION_CONFLICT', message: 'Note version conflict', retryable: false }
        };
      }

      if (note.current_revision_id) {
        this.repo.updateRevisionStatus(db, note.current_revision_id, 'deactive', 'approved', null);
      }

      // Remove from FTS5 index immediately
      this.repo.deleteFts(db, note.id);

      note.version += 1;
      note.updated_at = now;
      this.repo.saveNote(db, note);

      return {
        ok: true,
        value: toNoteView(note)
      };
    }, command);
  }

  async rollbackNote(input: { noteId: string; revisionId: string; expectedVersion: number }, command?: Command<typeof input>): Promise<Result<NoteView>> {
    const now = this.clock();
    const db = this.store.connection;

    return this.execute('rollbackNote', input, () => {
      const note = this.repo.findNoteById(db, input.noteId);
      if (!note) {
        return {
          ok: false,
          error: { code: 'NOTE_NOT_FOUND', message: `Note not found: ${input.noteId}`, retryable: false }
        };
      }

      if (input.expectedVersion !== undefined && note.version !== input.expectedVersion) {
        return {
          ok: false,
          error: { code: 'VERSION_CONFLICT', message: 'Note version conflict', retryable: false }
        };
      }

      const rev = this.repo.findRevisionById(db, input.revisionId);
      if (!rev || rev.note_id !== note.id || rev.status !== 'approved') {
        return {
          ok: false,
          error: { code: 'INVALID_REVISION', message: 'Cannot rollback to unapproved revision', retryable: false }
        };
      }

      if (!this.revisionStore?.matchesSnapshot(rev.content, rev.hash)) {
        return { ok: false, error: { code: 'SNAPSHOT_INTEGRITY', message: 'The approved revision is missing or damaged. Restore the immutable snapshot before rollback.', retryable: false } };
      }

      this.repo.updateRevisionStatus(db, rev.id, 'active', 'approved', now);
      const newVersion = note.version + 1;
      this.repo.updateNoteActiveRevision(db, note.id, rev.id, newVersion, now);
      note.current_revision_id = rev.id;
      note.version = newVersion;
      note.updated_at = now;

      // Re-index into FTS5
      this.repo.upsertFts(db, note.id, rev.id, note.title, rev.content);

      return {
        ok: true,
        value: toNoteView(note)
      };
    }, command);
  }

  async shareNote(input: ShareInput, command?: Command<ShareInput>): Promise<Result<NoteView>> {
    const parse = ShareInputSchema.safeParse(input);
    if (!parse.success) {
      return {
        ok: false,
        error: { code: 'INVALID_INPUT', message: 'Invalid share input envelope', retryable: false }
      };
    }

    const now = this.clock();
    const db = this.store.connection;

    return this.execute('shareNote', input, () => {
      const note = this.repo.findNoteById(db, input.noteId);
      if (!note) {
        return {
          ok: false,
          error: { code: 'NOTE_NOT_FOUND', message: `Note not found: ${input.noteId}`, retryable: false }
        };
      }

      if (note.version !== input.expectedVersion) {
        return {
          ok: false,
          error: { code: 'VERSION_CONFLICT', message: 'Note version conflict', retryable: false }
        };
      }

      if (!note.current_revision_id) {
        return {
          ok: false,
          error: { code: 'NOTE_NOT_ACTIVE', message: 'Note has no active revision to share', retryable: false }
        };
      }

      const rev = this.repo.findRevisionById(db, note.current_revision_id);
      if (!rev || rev.state !== 'active' || rev.status !== 'approved' || rev.hash !== input.expectedActiveHash) {
        return {
          ok: false,
          error: {
            code: 'STALE_NOTE_HASH',
            message: 'Active revision hash mismatch for shared note',
            retryable: false
          }
        };
      }

      const newVersion = note.version + 1;
      this.repo.updateNoteSharing(db, note.id, input.projectIds, newVersion, now);
      note.shared_with_project_ids = JSON.stringify(input.projectIds);
      note.version = newVersion;
      note.updated_at = now;

      return {
        ok: true,
        value: toNoteView(note)
      };
    }, command);
  }
}
