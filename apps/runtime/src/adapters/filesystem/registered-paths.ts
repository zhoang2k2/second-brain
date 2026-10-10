import * as fs from 'node:fs';
import * as path from 'node:path';
import { Result } from '@zhon/contracts';

export class RegisteredRootPolicy {
  private allowedRoots: string[];

  constructor(allowedRoots?: string[]) {
    this.allowedRoots = (allowedRoots ?? []).map(root => fs.realpathSync(root));
  }

  addAllowedRoot(rootPath: string): void {
    this.allowedRoots.push(fs.realpathSync(rootPath));
  }

  validate(targetPath: string): Result<string> {
    // 1. Disallow path traversal characters
    if (targetPath.includes('..')) {
      return {
        ok: false,
        error: {
          code: 'PATH_OUT_OF_SCOPE',
          message: 'Path traversal (..) is forbidden',
          retryable: false
        }
      };
    }

    // 2. Check existence on filesystem
    if (!fs.existsSync(targetPath)) {
      return {
        ok: false,
        error: {
          code: 'PATH_OUT_OF_SCOPE',
          message: `Path does not exist: ${targetPath}`,
          retryable: false
        }
      };
    }

    // 3. Resolve canonical real path (evaluates all symlinks)
    let canonicalPath: string;
    try {
      canonicalPath = fs.realpathSync(targetPath);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        ok: false,
        error: {
          code: 'PATH_OUT_OF_SCOPE',
          message: `Failed to resolve real path: ${msg}`,
          retryable: false
        }
      };
    }

    // Canonical scopes are pinned at configuration time, never re-resolved.
    if (this.allowedRoots.length === 0) {
      return { ok: false, error: { code: 'PATH_OUT_OF_SCOPE', message: 'No allowed filesystem roots are configured', retryable: false } };
    }
    {
      const allowedRealRoots = this.allowedRoots;
      const isInside = allowedRealRoots.some(allowed => {
        const relative = path.relative(allowed, canonicalPath);
        return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
      });

      if (!isInside) {
        return {
          ok: false,
          error: {
            code: 'PATH_OUT_OF_SCOPE',
            message: `Canonical path ${canonicalPath} escapes allowed roots`,
            retryable: false
          }
        };
      }
    }

    return { ok: true, value: canonicalPath };
  }
}
