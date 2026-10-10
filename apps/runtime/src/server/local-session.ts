import * as crypto from 'node:crypto';
import { Result } from '@zhon/contracts';

export interface LocalSessionConfig {
  allowedOrigins: string[];
  bootstrapTtlMs?: number;
  sessionTtlMs?: number;
  requireSession?: boolean;
}

export type SessionAudience = 'browser' | 'cli';

interface BootstrapEntry {
  audience: SessionAudience;
  code: string;
  createdAt: number;
  consumed: boolean;
}

interface SessionEntry {
  audience: SessionAudience;
  sessionId: string;
  createdAt: number;
  lastAccessedAt: number;
}

export class LocalSessionManager {
  private allowedOrigins: Set<string>;
  private bootstrapTtlMs: number;
  private sessionTtlMs: number;
  private bootstrapCodes: Map<string, BootstrapEntry> = new Map();
  private activeSessions: Map<string, SessionEntry> = new Map();

  constructor(config: LocalSessionConfig) {
    this.allowedOrigins = new Set(config.allowedOrigins);
    this.bootstrapTtlMs = config.bootstrapTtlMs ?? 5 * 60 * 1000; // 5 minutes
    this.sessionTtlMs = config.sessionTtlMs ?? 24 * 60 * 60 * 1000; // 24 hours
  }

  generateBootstrapCode(audience: SessionAudience = 'browser'): string {
    const code = crypto.randomBytes(32).toString('hex');
    this.bootstrapCodes.set(code, {
      code,
      audience,
      createdAt: Date.now(),
      consumed: false
    });
    return code;
  }

  createLocalSession(params: { bootstrapCode: string; origin?: string }): Result<{ sessionId: string }> {
    const { bootstrapCode, origin } = params;

    // 1. Origin validation: browser requests must provide a recognized local origin
    if (origin) {
      if (origin === 'null' || !this.allowedOrigins.has(origin)) {
        return {
          ok: false,
          error: {
            code: 'FORBIDDEN_ORIGIN',
            message: `Forbidden origin: ${origin}`,
            retryable: false
          }
        };
      }
    } else {
      // If origin is missing when creating a local session, reject or require valid origin
      return {
        ok: false,
        error: {
          code: 'FORBIDDEN_ORIGIN',
          message: 'Origin header is required for session creation',
          retryable: false
        }
      };
    }

    // 2. Validate bootstrap code
    const entry = this.bootstrapCodes.get(bootstrapCode);
    if (!entry) {
      return {
        ok: false,
        error: {
          code: 'INVALID_BOOTSTRAP_CODE',
          message: 'Invalid or unknown bootstrap code',
          retryable: false
        }
      };
    }

    if (entry.consumed) {
      return {
        ok: false,
        error: {
          code: 'INVALID_BOOTSTRAP_CODE',
          message: 'Bootstrap code has already been used',
          retryable: false
        }
      };
    }

    if (Date.now() - entry.createdAt > this.bootstrapTtlMs) {
      this.bootstrapCodes.delete(bootstrapCode);
      return {
        ok: false,
        error: {
          code: 'INVALID_BOOTSTRAP_CODE',
          message: 'Bootstrap code has expired',
          retryable: false
        }
      };
    }

    // Mark as consumed immediately to prevent replay attacks
    entry.consumed = true;
    this.bootstrapCodes.delete(bootstrapCode);

    // 3. Create session
    const sessionId = crypto.randomBytes(32).toString('hex');
    this.activeSessions.set(sessionId, {
      sessionId,
      audience: entry.audience,
      createdAt: Date.now(),
      lastAccessedAt: Date.now()
    });

    return {
      ok: true,
      value: { sessionId }
    };
  }

  validateSession(sessionId?: string, audience?: SessionAudience): boolean {
    if (!sessionId) return false;
    const session = this.activeSessions.get(sessionId);
    if (!session || (audience && session.audience !== audience)) return false;

    if (Date.now() - session.createdAt > this.sessionTtlMs) {
      this.activeSessions.delete(sessionId);
      return false;
    }

    session.lastAccessedAt = Date.now();
    return true;
  }

  validateOrigin(origin?: string): boolean {
    if (!origin) return true; // Local direct requests (e.g. CLI) without origin header
    if (origin === 'null') return false;
    return this.allowedOrigins.has(origin);
  }

  revokeSession(sessionId: string): void {
    this.activeSessions.delete(sessionId);
  }
}
