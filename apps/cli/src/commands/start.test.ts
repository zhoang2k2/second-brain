import { describe, it, expect } from 'vitest';
import { runCli } from '../main';
import { CliIO, CliDeps } from '../client';

describe('CLI start command & idempotency', () => {
  it('start_twice_does_not_spawn_twice', async () => {
    const outputs: string[] = [];
    const errors: string[] = [];
    const io: CliIO = {
      out: (t) => outputs.push(t),
      err: (t) => errors.push(t)
    };

    let spawnCount = 0;
    let isRunning = false;

    const deps: CliDeps = {
      connect: async () => {
        if (!isRunning) {
          throw new Error('Not running');
        }
        return {
          health: async () => ({ ready: true, checks: [] }),
          registerProject: async () => ({ ok: true, value: { id: '1', root: '/a', version: 1, createdAt: new Date().toISOString() } }),
          registerVault: async () => ({ ok: true, value: { id: '1', root: '/a', version: 1, createdAt: new Date().toISOString() } })
        };
      },
      startManagedRuntime: async () => {
        spawnCount++;
        isRunning = true;
      }
    };

    const code1 = await runCli(['start'], io, deps);
    expect(code1).toBe(0);
    expect(spawnCount).toBe(1);

    const code2 = await runCli(['start'], io, deps);
    expect(code2).toBe(0);
    expect(spawnCount).toBe(1); // Should not spawn twice
  });
});
