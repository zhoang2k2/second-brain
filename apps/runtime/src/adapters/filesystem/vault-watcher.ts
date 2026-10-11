import * as fs from 'node:fs';
import * as path from 'node:path';

export interface VaultWatcherConfig {
  vaultRoot: string;
  debounceMs?: number;
  onChange: (relPath: string) => void;
  onError?: (err: Error) => void;
}

export class VaultWatcher {
  private vaultRoot: string;
  private debounceMs: number;
  private onChange: (relPath: string) => void;
  private onError?: (err: Error) => void;
  private watcher?: fs.FSWatcher;
  private timers = new Map<string, NodeJS.Timeout>();
  private closed = false;

  constructor(config: VaultWatcherConfig) {
    this.vaultRoot = path.resolve(config.vaultRoot);
    this.debounceMs = config.debounceMs ?? 100;
    this.onChange = config.onChange;
    this.onError = config.onError;
  }

  start(): void {
    if (this.closed || this.watcher) return;

    try {
      this.watcher = fs.watch(
        this.vaultRoot,
        { recursive: true },
        (_eventType, filename) => {
          if (!filename) return;
          this.notifyChange(filename);
        }
      );

      this.watcher.on('error', err => {
        if (this.onError) {
          this.onError(err);
        }
      });
    } catch (err: unknown) {
      if (this.onError && err instanceof Error) {
        this.onError(err);
      }
    }
  }

  notifyChange(rawRelPath: string): void {
    if (this.closed) return;

    const normalized = rawRelPath.replace(/\\/g, '/');
    if (!normalized.endsWith('.md')) return;
    if (normalized.split('/').some(part => part.startsWith('.'))) return;

    const existing = this.timers.get(normalized);
    if (existing) {
      clearTimeout(existing);
    }

    const timer = setTimeout(async () => {
      this.timers.delete(normalized);
      if (!this.closed) {
        try {
          await this.onChange(normalized);
        } catch (err: unknown) {
          if (this.onError && err instanceof Error) {
            this.onError(err);
          }
        }
      }
    }, this.debounceMs);

    this.timers.set(normalized, timer);
  }

  close(): void {
    this.closed = true;
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    this.timers.clear();

    if (this.watcher) {
      try {
        this.watcher.close();
      } catch {
        // Ignore close errors
      }
      this.watcher = undefined;
    }
  }
}
