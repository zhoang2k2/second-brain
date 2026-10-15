import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import * as crypto from 'node:crypto';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { RevisionStore } from './revision-store';

describe('RevisionStore', () => {
  let tempDir: string;
  let revisionStore: RevisionStore;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zhon-rev-store-test-'));
    revisionStore = new RevisionStore({ revisionsDir: tempDir });
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('writes_immutable_snapshot_keyed_by_sha256', async () => {
    const markdown = '# Test Note\nThis is a snapshot test.';
    const expectedHash = crypto.createHash('sha256').update(markdown, 'utf8').digest('hex');

    const result = await revisionStore.writeRevisionSnapshot('note-1', markdown);

    expect(result.contentHash).toBe(expectedHash);
    expect(result.revisionId).toBeDefined();
    expect(result.path).toBe(path.join(tempDir, `${expectedHash}.md`));
    expect(fs.existsSync(result.path)).toBe(true);

    const storedContent = fs.readFileSync(result.path, 'utf8');
    expect(storedContent).toBe(markdown);
  });

  it('repeated_write_returns_same_content_hash_and_path', async () => {
    const markdown = '# Deduplicated Note\nSame content twice.';

    const first = await revisionStore.writeRevisionSnapshot('note-1', markdown);
    const second = await revisionStore.writeRevisionSnapshot('note-1', markdown);

    expect(second.contentHash).toBe(first.contentHash);
    expect(second.path).toBe(first.path);
  });

  it('reads_snapshot_by_hash', async () => {
    const markdown = '# Readable Note\nTesting read capability.';
    const { contentHash } = await revisionStore.writeRevisionSnapshot('note-2', markdown);

    const read = await revisionStore.readRevisionSnapshot(contentHash);
    expect(read).toBe(markdown);
  });

  it('handles_missing_snapshot', async () => {
    const nonExistentHash = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
    const read = await revisionStore.readRevisionSnapshot(nonExistentHash);
    expect(read).toBeNull();
  });
});
