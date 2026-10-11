import { describe, it, expect, beforeEach } from 'vitest';
import { LocalSessionManager } from './local-session';

describe('LocalSessionManager', () => {
  let sessionManager: LocalSessionManager;
  const allowedOrigins = ['http://localhost:3000', 'http://127.0.0.1:3000'];

  beforeEach(() => {
    sessionManager = new LocalSessionManager({
      allowedOrigins,
      bootstrapTtlMs: 60000
    });
  });

  it('rejects_bad_origin', () => {
    const bootstrapCode = sessionManager.generateBootstrapCode();

    // Foreign origin rejection
    const foreignResult = sessionManager.createLocalSession({
      bootstrapCode,
      origin: 'https://other.example'
    });
    expect(foreignResult.ok).toBe(false);
    if (!foreignResult.ok) {
      expect(foreignResult.error.code).toBe('FORBIDDEN_ORIGIN');
    }

    // Null origin when browser origin is expected
    const nullOriginResult = sessionManager.createLocalSession({
      bootstrapCode,
      origin: 'null'
    });
    expect(nullOriginResult.ok).toBe(false);
    if (!nullOriginResult.ok) {
      expect(nullOriginResult.error.code).toBe('FORBIDDEN_ORIGIN');
    }
  });

  it('rejects_replayed_bootstrap', () => {
    const bootstrapCode = sessionManager.generateBootstrapCode();

    // First use: must succeed
    const firstAttempt = sessionManager.createLocalSession({
      bootstrapCode,
      origin: 'http://localhost:3000'
    });
    expect(firstAttempt.ok).toBe(true);
    if (firstAttempt.ok) {
      expect(firstAttempt.value.sessionId).toBeDefined();
    }

    // Second use (replay attack): must fail
    const secondAttempt = sessionManager.createLocalSession({
      bootstrapCode,
      origin: 'http://localhost:3000'
    });
    expect(secondAttempt.ok).toBe(false);
    if (!secondAttempt.ok) {
      expect(secondAttempt.error.code).toBe('INVALID_BOOTSTRAP_CODE');
    }
  });

  it('validates_active_session', () => {
    const bootstrapCode = sessionManager.generateBootstrapCode();
    const sessionRes = sessionManager.createLocalSession({
      bootstrapCode,
      origin: 'http://localhost:3000'
    });
    expect(sessionRes.ok).toBe(true);
    if (sessionRes.ok) {
      expect(sessionManager.validateSession(sessionRes.value.sessionId)).toBe(true);
    }
  });

  it('rejects_invalid_session', () => {
    expect(sessionManager.validateSession('non-existent-session-id')).toBe(false);
    expect(sessionManager.validateSession(undefined)).toBe(false);
  });
});


it('browser_session_cannot_authorize_cli_bearer_requests', () => {
  const manager = new LocalSessionManager({ allowedOrigins: ['http://localhost:3000'] });
  const code = manager.generateBootstrapCode();
  const result = manager.createLocalSession({ bootstrapCode: code, origin: 'http://localhost:3000' });
  expect(result.ok).toBe(true);
  if (result.ok) expect(manager.validateSession(result.value.sessionId, 'cli')).toBe(false);
});
