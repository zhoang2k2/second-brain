import { describe, it, expect } from 'vitest';
import { runCli } from '../main';
import { CliIO, CliDeps, ApiClient } from '../client';

describe('CLI status command', () => {
  it('status_missing_runtime_exit_1', async () => {
    const outputs: string[] = [];
    const errors: string[] = [];
    const io: CliIO = {
      out: (t) => outputs.push(t),
      err: (t) => errors.push(t)
    };

    const deps: CliDeps = {
      connect: async () => {
        throw new Error('Connection refused (token=secret123)');
      },
      startManagedRuntime: async () => {}
    };

    const code = await runCli(['status'], io, deps);
    expect(code).toBe(1);
    expect(errors.some(e => e.includes('[REDACTED]') && !e.includes('secret123'))).toBe(true);
  });

  it('status_timeout_exit_1', async () => {
    const outputs: string[] = [];
    const errors: string[] = [];
    const io: CliIO = {
      out: (t) => outputs.push(t),
      err: (t) => errors.push(t)
    };

    const deps: CliDeps = {
      connect: async () => {
        return {
          health: async () => ({ ready: false, checks: [] }),
          registerProject: async () => ({ ok: true, value: { id: '1', root: '/a', version: 1, createdAt: new Date().toISOString() } }),
          registerVault: async () => ({ ok: true, value: { id: '1', root: '/a', version: 1, createdAt: new Date().toISOString() } })
        };
      },
      startManagedRuntime: async () => {}
    };

    const code = await runCli(['status'], io, deps);
    expect(code).toBe(1);
    expect(errors).toContain('Runtime is not ready');
  });

  it('unknown_command_exit_2', async () => {
    const outputs: string[] = [];
    const errors: string[] = [];
    const io: CliIO = {
      out: (t) => outputs.push(t),
      err: (t) => errors.push(t)
    };

    const deps: CliDeps = {
      connect: async () => ({} as ApiClient),
      startManagedRuntime: async () => {}
    };

    const code = await runCli(['unknowncmd'], io, deps);
    expect(code).toBe(2);
  });
});
