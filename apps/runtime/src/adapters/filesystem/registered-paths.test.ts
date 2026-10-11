import { it, expect } from 'vitest';
import { mkdtempSync, mkdirSync, symlinkSync, unlinkSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { RegisteredRootPolicy } from './registered-paths';

it('unconfigured_roots_deny_registration', () => {
  expect(new RegisteredRootPolicy().validate(tmpdir()).ok).toBe(false);
});

it('changing_allowlist_symlink_cannot_move_the_boundary', () => {
  const root = mkdtempSync(join(tmpdir(), 'zhon-policy-'));
  try {
    const original = join(root, 'original');
    const outside = join(root, 'outside');
    const link = join(root, 'scope');
    mkdirSync(original);
    mkdirSync(outside);
    symlinkSync(original, link);
    const policy = new RegisteredRootPolicy([link]);
    expect(policy.validate(original).ok).toBe(true);
    unlinkSync(link);
    symlinkSync(outside, link);
    expect(policy.validate(link).ok).toBe(false);
    expect(policy.validate(outside).ok).toBe(false);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
