import * as fs from 'node:fs';
import * as path from 'node:path';
import type Database from 'better-sqlite3';
import type { Result } from '@zhon/contracts';
import { parseFrontmatter } from './frontmatter';
import { noteSource, singleVault } from './source-access';

/** Never guess which authored file owns an explicit identity. */
export function validateSourceIdentity(db: Database.Database, relativePath: string, content: string, noteId?: string): Result<void> {
  const parsed = parseFrontmatter(content);
  if (!parsed.ok) return { ok: false, error: { code: 'INCOMPLETE_YAML', message: parsed.error ?? 'Invalid flat note properties.', retryable: false } };
  const identity = parsed.frontmatter.zhon_id;
  if (!identity) return { ok: true, value: undefined };
  if (noteId && identity !== noteId) return { ok: false, error: { code: 'IDENTITY_CHANGED', message: 'The source identity changed. Restore the original ID or resolve the note identity explicitly.', retryable: false } };
  const vault = singleVault(db);
  if (!vault.ok) return vault;
  let matches = 0;
  const visit = (directory: string) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (entry.name.startsWith('.')) continue;
      const full = path.join(directory, entry.name);
      if (entry.isDirectory()) { visit(full); continue; }
      if (!entry.isFile() || !entry.name.endsWith('.md')) continue;
      const relative = path.relative(vault.value.root, full);
      const source = noteSource(db, relative);
      if (!source.ok) continue;
      // Oversize body content is ineligible, but its bounded flat header can
      // still claim another note's identity and must not bypass duplicate checks.
      let bytes = content;
      if (relative !== relativePath) {
        const descriptor = fs.openSync(source.path, 'r');
        try {
          const buffer = Buffer.alloc(Math.min(fs.fstatSync(descriptor).size, 1048576));
          const length = fs.readSync(descriptor, buffer, 0, buffer.length, 0);
          bytes = buffer.subarray(0, length).toString('utf8');
        } finally { fs.closeSync(descriptor); }
      }
      if (parseFrontmatter(bytes).frontmatter.zhon_id === identity) matches++;
    }
  };
  try { visit(vault.value.root); } catch {
    return { ok: false, error: { code: 'IDENTITY_UNVERIFIED', message: 'Cannot verify source identity in the registered vault. Restore access and rescan.', retryable: true } };
  }
  if (matches !== 1) return { ok: false, error: { code: 'DUPLICATE_NOTE_ID', message: 'Multiple source files claim the same note ID. Resolve the duplicate and rescan.', retryable: false } };
  return { ok: true, value: undefined };
}
