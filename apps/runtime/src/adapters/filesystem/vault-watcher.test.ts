import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { VaultWatcher } from './vault-watcher';

describe('VaultWatcher', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vault-watcher-test-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('filters markdown files and ignores non-markdown and hidden paths', async () => {
    const changes: string[] = [];
    const watcher = new VaultWatcher({
      vaultRoot: tempDir,
      debounceMs: 20,
      onChange: (relPath: string) => {
        changes.push(relPath);
      }
    });

    watcher.start();

    // Notify markdown file
    watcher.notifyChange('notes/daily.md');
    // Notify non-markdown files
    watcher.notifyChange('images/photo.png');
    watcher.notifyChange('data.json');
    watcher.notifyChange('readme.txt');
    // Notify hidden files/folders
    watcher.notifyChange('.obsidian/workspace.json');
    watcher.notifyChange('.git/config');
    watcher.notifyChange('.DS_Store');

    // Wait for debounce
    await new Promise(r => setTimeout(r, 60));

    expect(changes).toEqual(['notes/daily.md']);
    watcher.close();
  });

  it('debounces rapid repeated writes within debounce window', () => {
    vi.useFakeTimers();
    try {
      const onChange = vi.fn();
      const watcher = new VaultWatcher({
        vaultRoot: tempDir,
        debounceMs: 100,
        onChange
      });

      watcher.start();

      // Fire 5 rapid notifications for the same file within 50ms
      watcher.notifyChange('note.md');
      vi.advanceTimersByTime(20);
      watcher.notifyChange('note.md');
      vi.advanceTimersByTime(20);
      watcher.notifyChange('note.md');
      vi.advanceTimersByTime(20);
      watcher.notifyChange('note.md');
      vi.advanceTimersByTime(20);
      watcher.notifyChange('note.md');

      expect(onChange).not.toHaveBeenCalled();

      // Advance time beyond debounce window
      vi.advanceTimersByTime(120);
      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenCalledWith('note.md');

      watcher.close();
    } finally {
      vi.useRealTimers();
    }
  });

  it('close cleanly cancels pending timers and stops watcher', () => {
    vi.useFakeTimers();
    try {
      const onChange = vi.fn();
      const watcher = new VaultWatcher({
        vaultRoot: tempDir,
        debounceMs: 100,
        onChange
      });

      watcher.start();
      watcher.notifyChange('pending.md');

      // Close before timer fires
      watcher.close();

      vi.advanceTimersByTime(200);
      expect(onChange).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('handles errors gracefully on invalid directory', () => {
    const errors: Error[] = [];
    const nonExistent = path.join(tempDir, 'does-not-exist');
    const watcher = new VaultWatcher({
      vaultRoot: nonExistent,
      debounceMs: 50,
      onChange: () => {},
      onError: (err: Error) => {
        errors.push(err);
      }
    });

    watcher.start();
    expect(errors.length).toBeGreaterThan(0);
    watcher.close();
  });
});
