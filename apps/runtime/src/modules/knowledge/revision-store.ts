import * as fs from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';

export interface RevisionStoreConfig {
  revisionsDir: string;
}

export class RevisionStore {
  private revisionsDir: string;

  constructor(config: RevisionStoreConfig) {
    this.revisionsDir = path.resolve(config.revisionsDir);
    fs.mkdirSync(this.revisionsDir, { recursive: true });
  }

  getDirectory(): string {
    return this.revisionsDir;
  }

  async writeRevisionSnapshot(
    _noteId: string,
    markdown: string
  ): Promise<{ revisionId: string; path: string; contentHash: string }> {
    const contentHash = crypto.createHash('sha256').update(markdown, 'utf8').digest('hex');
    const snapshotPath = path.join(this.revisionsDir, `${contentHash}.md`);

    if (!fs.existsSync(snapshotPath)) {
      const descriptor = fs.openSync(snapshotPath, 'wx', 0o600);
      try {
        fs.writeFileSync(descriptor, markdown, 'utf8');
        fs.fsyncSync(descriptor);
      } finally { fs.closeSync(descriptor); }
    }
    if (fs.readFileSync(snapshotPath, 'utf8') !== markdown) {
      throw new Error('Revision snapshot integrity check failed');
    }

    const revisionId = `rev-${crypto.randomUUID()}`;
    return {
      revisionId,
      path: snapshotPath,
      contentHash
    };
  }

  async readRevisionSnapshot(contentHash: string): Promise<string | null> {
    if (!/^[a-f0-9]{64}$/.test(contentHash)) throw new Error('Invalid snapshot hash');
    const snapshotPath = path.join(this.revisionsDir, `${contentHash}.md`);
    if (!fs.existsSync(snapshotPath)) {
      return null;
    }
    return fs.readFileSync(snapshotPath, 'utf8');
  }

  getSnapshotPath(contentHash: string): string {
    if (!/^[a-f0-9]{64}$/.test(contentHash)) throw new Error('Invalid snapshot hash');
    return path.join(this.revisionsDir, `${contentHash}.md`);
  }

  matchesSnapshot(markdown: string, contentHash: string): boolean {
    if (crypto.createHash('sha256').update(markdown, 'utf8').digest('hex') !== contentHash) return false;
    try {
      const snapshot = this.getSnapshotPath(contentHash);
      if (!fs.lstatSync(snapshot).isFile()) return false;
      return fs.readFileSync(snapshot, 'utf8') === markdown;
    } catch { return false; }
  }
}
