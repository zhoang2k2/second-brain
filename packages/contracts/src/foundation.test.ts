import { describe, it, expect } from 'vitest';
import {
  RegistrationInputSchema,
  ProjectSchema,
  VaultSchema,
  HealthSchema,
  ScopeSchema,
  ApiErrorSchema,
  CommandSchema,
  validProjectFixture,
  invalidProjectFixture,
  validVaultFixture,
  invalidVaultFixture,
  validHealthFixture,
  degradedHealthFixture,
  validRegistrationInputFixture,
  invalidRegistrationInputFixture,
  apiErrorFixture
} from './index';

describe('foundation and contract comprehensive tests', () => {
  it('foundation_rejects_unknown_fields', () => {
    expect(RegistrationInputSchema.safeParse(invalidRegistrationInputFixture).success).toBe(false);
  });

  it('rejects path traversal in registration input', () => {
    expect(RegistrationInputSchema.safeParse({ root: '/a/../b' }).success).toBe(false);
    expect(RegistrationInputSchema.safeParse(validRegistrationInputFixture).success).toBe(true);
  });

  it('ProjectSchema validates createdAt and path traversal', () => {
    expect(ProjectSchema.safeParse(validProjectFixture).success).toBe(true);
    expect(ProjectSchema.safeParse(invalidProjectFixture).success).toBe(false);
  });

  it('VaultSchema validates createdAt and path traversal', () => {
    expect(VaultSchema.safeParse(validVaultFixture).success).toBe(true);
    expect(VaultSchema.safeParse(invalidVaultFixture).success).toBe(false);
  });

  it('HealthSchema validates PASS, FAIL, BLOCKED statuses', () => {
    expect(HealthSchema.safeParse(validHealthFixture).success).toBe(true);
    expect(HealthSchema.safeParse(degradedHealthFixture).success).toBe(true);
    expect(HealthSchema.safeParse({ ready: true, checks: [{ name: 'test', status: 'UNKNOWN' }] }).success).toBe(false);
  });

  it('Command envelope validation', () => {
    const cmdSchema = CommandSchema(RegistrationInputSchema);
    const validCmd = {
      requestId: 'req-1',
      idempotencyKey: 'idem-1',
      expectedVersion: 1,
      payload: validRegistrationInputFixture
    };
    expect(cmdSchema.safeParse(validCmd).success).toBe(true);
    expect(cmdSchema.safeParse({ requestId: 'req-1', idempotencyKey: 'idem-1', payload: { root: 'bad..' } }).success).toBe(false);
  });

  it('Scope validation', () => {
    expect(ScopeSchema.safeParse({ kind: 'global' }).success).toBe(true);
    expect(ScopeSchema.safeParse({ kind: 'project', projectId: 'proj-1' }).success).toBe(true);
    expect(ScopeSchema.safeParse({ kind: 'vault' }).success).toBe(false);
  });

  it('ApiError retryable field validation', () => {
    expect(ApiErrorSchema.safeParse(apiErrorFixture).success).toBe(true);
    expect(ApiErrorSchema.safeParse({ code: 'ERR', message: 'msg' }).success).toBe(false);
  });
});
