import * as fs from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
import { Result, NoteView, RevisionView, CandidateView, Scope } from '@zhon/contracts';
import { Store } from '../../storage/database';
import { RegisteredRootPolicy } from '../../adapters/filesystem/registered-paths';
import { RevisionStore } from './revision-store';
import { KnowledgeRepository, toNoteView, toRevisionView, toCandidateView, NoteRecord } from './repository';
import { noteSource, singleVault } from './source-access';
import { validateSourceIdentity } from './source-identity';

export interface KnowledgeIngestionConfig {
  store: Store;
  repo: KnowledgeRepository;
  revisionStore: RevisionStore;
  policy: RegisteredRootPolicy;
  clock?: () => string;
}

export interface CaptureNoteInput {
  vaultId: string;
  path: string;
  defaultScope?: Scope;
}

import { parseFrontmatter } from './frontmatter';
export { parseFrontmatter } from './frontmatter';
export function extractTitle(relPath: string, frontmatter: Record<string, string>, content: string): string {
  if (frontmatter.title) return frontmatter.title;

  const match = content.match(/^#\s+(.+)$/m);
  if (match && match[1]) {
    return match[1].trim();
  }

  return path.basename(relPath, path.extname(relPath));
}

export class KnowledgeIngestionService {
  private store: Store;
  private repo: KnowledgeRepository;
  private revisionStore: RevisionStore;
  private policy: RegisteredRootPolicy;
  private clock: () => string;

  constructor(config: KnowledgeIngestionConfig) {
    this.store = config.store;
    this.repo = config.repo;
    this.revisionStore = config.revisionStore;
    this.policy = config.policy;
    this.clock = config.clock ?? (() => new Date().toISOString());
  }

  private getVaultRoot(vaultId: string): string | null {
    const row = this.store.connection.prepare('SELECT root FROM vaults WHERE id = ?').get(vaultId) as
      | { root: string }
      | undefined;
    return row?.root ?? null;
  }

  async captureNote(
    input: CaptureNoteInput
  ): Promise<Result<{ note: NoteView; revision: RevisionView; candidate: CandidateView }>> {
    const now = this.clock();
    const registeredVault = singleVault(this.store.connection);
    if (!registeredVault.ok) return registeredVault;
    if (registeredVault.value.id !== input.vaultId) {
      return { ok: false, error: { code: 'VAULT_NOT_FOUND', message: 'Vault is not registered.', retryable: false } };
    }
    const vaultRoot = this.getVaultRoot(input.vaultId);
    if (!vaultRoot) {
      return {
        ok: false,
        error: { code: 'VAULT_NOT_FOUND', message: `Vault not found: ${input.vaultId}`, retryable: false }
      };
    }

    // 1. Path traversal check
    if (input.path.includes('..')) {
      return {
        ok: false,
        error: { code: 'PATH_OUT_OF_SCOPE', message: 'Path traversal forbidden: ' + input.path, retryable: false }
      };
    }

    const fullPath = path.resolve(vaultRoot, input.path);
    const source = noteSource(this.store.connection, input.path);
    if (!source.ok) {
      const existing = this.repo.findNoteByPath(this.store.connection, input.path);
      if (existing) {
        this.repo.updateNoteAvailability(this.store.connection, existing.id, source.availability, now);
        this.repo.deleteFts(this.store.connection, existing.id);
      }
      return { ok: false, error: { code: 'PATH_OUT_OF_SCOPE', message: 'Source is missing or outside the registered vault.', retryable: false } };
    }

    // 2. Existence check & deleted source handling
    if (!fs.existsSync(fullPath)) {
      const relNormalized = path.relative(fs.realpathSync(vaultRoot), fullPath).replace(/\\/g, '/');
      const existing = this.repo.findNoteByPath(this.store.connection, relNormalized);
      if (existing) {
        this.repo.updateNoteAvailability(this.store.connection, existing.id, 'missing', now);
        this.repo.deleteFts(this.store.connection, existing.id);
      }
      return {
        ok: false,
        error: { code: 'PATH_OUT_OF_SCOPE', message: 'File does not exist: ' + input.path, retryable: false }
      };
    }

    // 3. Canonical realpath & symlink boundary check
    let canonicalPath: string;
    let canonicalVaultRoot: string;
    try {
      canonicalPath = fs.realpathSync(fullPath);
      canonicalVaultRoot = fs.realpathSync(vaultRoot);
    } catch (err: unknown) {
      return {
        ok: false,
        error: {
          code: 'PATH_OUT_OF_SCOPE',
          message: 'Failed to resolve canonical path: ' + String(err),
          retryable: false
        }
      };
    }

    const relativeToRoot = path.relative(canonicalVaultRoot, canonicalPath);
    if (relativeToRoot.startsWith('..') || path.isAbsolute(relativeToRoot)) {
      return {
        ok: false,
        error: {
          code: 'PATH_OUT_OF_SCOPE',
          message: `Canonical path ${canonicalPath} escapes vault root`,
          retryable: false
        }
      };
    }

    const relVaultPath = relativeToRoot.replace(/\\/g, '/');

    // 4. File size check (Cap at 1 MiB)
    const stat = fs.statSync(canonicalPath);
    if (stat.size > 1048576) {
      return {
        ok: false,
        error: { code: 'NOTE_TOO_LARGE', message: 'Note exceeds 1 MiB limit', retryable: false }
      };
    }

    // 5. Read source content
    const content = fs.readFileSync(canonicalPath, 'utf8');
    await new Promise(resolve => setTimeout(resolve, 25));
    const stableSource = noteSource(this.store.connection, input.path);
    if (!stableSource.ok || stableSource.path !== canonicalPath || fs.readFileSync(stableSource.path, 'utf8') !== content) {
      return { ok: false, error: { code: 'UNSTABLE_SAVE', message: 'The note is still being saved. Retry after the save completes.', retryable: true } };
    }

    // 6. YAML Frontmatter check
    const fmResult = parseFrontmatter(content);
    if (!fmResult.ok) {
      return {
        ok: false,
        error: { code: 'INCOMPLETE_YAML', message: fmResult.error ?? 'Invalid YAML frontmatter', retryable: false }
      };
    }

    const frontmatter = fmResult.frontmatter;
    const rawZhonId = frontmatter.zhon_id;
    const existingAtPath = this.repo.findNoteByPath(this.store.connection, relVaultPath);
    const identity = validateSourceIdentity(this.store.connection, relVaultPath, content, existingAtPath?.id);
    if (!identity.ok) return identity;

    // 7. Identity & Duplicate ID validation
    if (rawZhonId) {
      const existingById = this.repo.findNoteById(this.store.connection, rawZhonId);
      if (existingById && existingById.path !== relVaultPath) {
        const otherFullPath = path.resolve(canonicalVaultRoot, existingById.path);
        if (fs.existsSync(otherFullPath)) {
          return {
            ok: false,
            error: {
              code: 'DUPLICATE_NOTE_ID',
              message: `Duplicate zhon_id '${rawZhonId}' also claimed by '${existingById.path}'`,
              retryable: false
            }
          };
        }
      }
    }

    // 8. Content hash & revision snapshot
    const contentHash = crypto.createHash('sha256').update(content, 'utf8').digest('hex');
    const title = extractTitle(relVaultPath, frontmatter, content);

    // Persist immutable bytes before publishing a database revision. A failed
    // filesystem write must not leave a Candidate that can be approved.
    try {
      await this.revisionStore.writeRevisionSnapshot(rawZhonId ?? '', content);
    } catch {
      return { ok: false, error: { code: 'SNAPSHOT_FAILED', message: 'Cannot persist the revision snapshot. Retry after checking local storage.', retryable: true } };
    }

    return this.store.transaction(() => {
      let note = this.repo.findNoteByPath(this.store.connection, relVaultPath);

      if (!note && rawZhonId) {
        note = this.repo.findNoteById(this.store.connection, rawZhonId);
      }

      if (!note) {
        // Create new note
        const noteId = rawZhonId || `note-${crypto.randomUUID()}`;
        const scope = input.defaultScope ?? { kind: 'global' };
        const newRecord: NoteRecord = {
          id: noteId,
          title,
          path: relVaultPath,
          current_revision_id: null,
          scope_kind: scope.kind,
          scope_project_id: scope.kind === 'project' ? scope.projectId : null,
          shared_with_project_ids: '[]',
          version: 1,
          availability: 'available',
          created_at: now,
          updated_at: now
        };
        this.repo.saveNote(this.store.connection, newRecord);
        note = newRecord;
      } else {
        // If note exists and availability is missing, restore to available
        if (note.availability !== 'available' || note.title !== title || note.path !== relVaultPath) {
          note.title = title;
          note.path = relVaultPath;
          note.availability = 'available';
          note.updated_at = now;
          this.repo.saveNote(this.store.connection, note);
        }
      }

      // A completed save supersedes pending bytes, while rejected history stays rejected.
      const pending = this.repo.listCandidates(this.store.connection, 'pending');
      for (const candidate of pending) {
        const revision = this.repo.findRevisionById(this.store.connection, candidate.revision_id);
        if (revision?.note_id === note.id && revision.hash !== contentHash) {
          this.repo.updateCandidateState(this.store.connection, candidate.id, 'stale', now);
        }
      }

      // Check if current active revision already matches content hash
      if (note.current_revision_id) {
        const activeRev = this.repo.findRevisionById(this.store.connection, note.current_revision_id);
        if (activeRev && activeRev.hash === contentHash) {
          if (activeRev.state === 'active' && activeRev.status === 'approved') {
            this.repo.upsertFts(this.store.connection, note.id, activeRev.id, note.title, activeRev.content);
          }
          // Unchanged active content: return existing active revision & existing candidate (or dummy view)
          let cand = this.repo.findCandidateByRevisionId(this.store.connection, activeRev.id);
          if (!cand) {
            cand = {
              id: `cand-${crypto.randomUUID()}`,
              revision_id: activeRev.id,
              version: note.version,
              expected_source_hash: contentHash,
              state: 'approved',
              processing: 'ready',
              created_at: now,
              updated_at: now
            };
          }
          return {
            ok: true,
            value: {
              note: toNoteView(note),
              revision: toRevisionView(activeRev),
              candidate: toCandidateView(cand)
            }
          };
        }
      }

      // Check if revision already exists for this note + hash
      let rev = this.repo.findRevisionByNoteAndHash(this.store.connection, note.id, contentHash);
      if (!rev) {
        const revId = `rev-${crypto.randomUUID()}`;
        rev = {
          id: revId,
          note_id: note.id,
          content,
          hash: contentHash,
          state: 'candidate',
          status: 'unreviewed',
          created_at: now,
          approved_at: null,
          origin: 'vault-import',
          parent_revision_id: note.current_revision_id
        };
        this.repo.saveRevision(this.store.connection, rev);
      }

      // Check if candidate already exists for this revision
      let cand = this.repo.findCandidateByRevisionId(this.store.connection, rev.id);
      if (!cand) {
        const candId = `cand-${crypto.randomUUID()}`;
        cand = {
          id: candId,
          revision_id: rev.id,
          version: note.version,
          expected_source_hash: contentHash,
          state: 'pending',
          processing: 'pending',
          created_at: now,
          updated_at: now
        };
        this.repo.saveCandidate(this.store.connection, cand);
      }

      const proposedLinks = this.repo.findLinksBySourceNoteId(this.store.connection, note.id);

      return {
        ok: true,
        value: {
          note: toNoteView(note),
          revision: toRevisionView(rev),
          candidate: toCandidateView(cand, proposedLinks)
        }
      };
    });
  }

  async rescanVault(vaultId: string): Promise<{ captured: number; blocked: number }> {
    const registered = singleVault(this.store.connection);
    if (!registered.ok || registered.value.id !== vaultId) return { captured: 0, blocked: 1 };
    const vaultRoot = this.getVaultRoot(vaultId);
    if (!vaultRoot || !fs.existsSync(vaultRoot)) {
      for (const note of this.repo.listNotes(this.store.connection)) {
        this.repo.updateNoteAvailability(this.store.connection, note.id, 'missing', this.clock());
        this.repo.deleteFts(this.store.connection, note.id);
      }
      return { captured: 0, blocked: 1 };
    }

    const canonicalVaultRoot = fs.realpathSync(vaultRoot);
    if (canonicalVaultRoot !== path.resolve(vaultRoot)) {
      for (const note of this.repo.listNotes(this.store.connection)) {
        this.repo.updateNoteAvailability(this.store.connection, note.id, 'unsafe', this.clock());
        this.repo.deleteFts(this.store.connection, note.id);
      }
      return { captured: 0, blocked: 1 };
    }
    let captured = 0;
    let blocked = 0;

    // Scan all .md files
    const mdFiles: string[] = [];
    const walk = (dir: string) => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name.startsWith('.')) continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(full);
        } else if (entry.isFile() && entry.name.endsWith('.md')) {
          mdFiles.push(path.relative(canonicalVaultRoot, full).replace(/\\/g, '/'));
        }
      }
    };
    walk(canonicalVaultRoot);

    // Identify missing notes
    const existingNotes = this.repo.listNotes(this.store.connection);
    const mdFileSet = new Set(mdFiles);
    for (const note of existingNotes) {
      if (!mdFileSet.has(note.path)) {
        this.repo.updateNoteAvailability(this.store.connection, note.id, 'missing', this.clock());
        this.repo.deleteFts(this.store.connection, note.id);
      }
    }

    // Check for ambiguous renames: multiple new files with same content matching a missing note without zhon_id
    const contentHashToFileMap = new Map<string, string[]>();
    for (const file of mdFiles) {
      const full = path.join(canonicalVaultRoot, file);
      try {
        const bytes = fs.readFileSync(full, 'utf8');
        const hash = crypto.createHash('sha256').update(bytes, 'utf8').digest('hex');
        const list = contentHashToFileMap.get(hash) ?? [];
        list.push(file);
        contentHashToFileMap.set(hash, list);
      } catch {
        // Skip unreadable files
      }
    }

    for (const file of mdFiles) {
      const full = path.join(canonicalVaultRoot, file);
      try {
        const bytes = fs.readFileSync(full, 'utf8');
        const hash = crypto.createHash('sha256').update(bytes, 'utf8').digest('hex');
        const duplicates = contentHashToFileMap.get(hash) ?? [];
        // If multiple files in vault share the same content without zhon_id and match a missing note
        if (duplicates.length > 1 && !bytes.includes('zhon_id:')) {
          const hasMissingNote = existingNotes.some(n => !mdFileSet.has(n.path));
          if (hasMissingNote) {
            blocked++;
            continue;
          }
        }

        const result = await this.captureNote({ vaultId, path: file });
        if (result.ok) {
          if (result.value.candidate.state === 'pending') {
            captured++;
          }
        } else {
          blocked++;
        }
      } catch {
        blocked++;
      }
    }

    return { captured, blocked };
  }
}
