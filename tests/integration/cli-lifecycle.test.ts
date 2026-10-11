import { it, expect } from 'vitest';
import { mkdtempSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execute = promisify(execFile);

it('starts_once_and_registers_across_separate_cli_processes', async () => {
  const root = mkdtempSync(join(tmpdir(), 'zhon-cli-lifecycle-'));
  const statePath = join(root, 'runtime.json');
  const bin = resolve('apps/cli/bin/zhon');
  const environment = {
    ...process.env,
    ZHON_DB_PATH: join(root, 'state.db'),
    ZHON_RUNTIME_STATE: statePath,
    ZHON_PORT: '4295',
    ZHON_RUNTIME_URL: 'http://127.0.0.1:4295',
    ZHON_ALLOWED_ORIGINS: 'http://127.0.0.1:4295,http://127.0.0.1:3000',
    ZHON_ALLOWED_ROOTS: root,
  };
  const invoke = (args: string[]) => execute(bin, args, { env: environment, timeout: 12000 });
  mkdirSync(join(root, 'project'));
  mkdirSync(join(root, 'vault'));
  let runtimePid: number | undefined;
  try {
    const started = await invoke(['start']);
    expect(started.stdout).toContain('Runtime started successfully');
    runtimePid = JSON.parse(readFileSync(statePath, 'utf8')).pid;
    await invoke(['start']);
    expect(JSON.parse(readFileSync(statePath, 'utf8')).pid).toBe(runtimePid);
    expect((await invoke(['project', 'register', join(root, 'project')])).stdout).toContain('Project registered successfully');
    expect((await invoke(['vault', 'register', join(root, 'vault')])).stdout).toContain('Vault registered successfully');
  } finally {
    if (runtimePid) {
      process.kill(runtimePid, 'SIGTERM');
      for (let attempt = 0; attempt < 50; attempt++) {
        try { process.kill(runtimePid, 0); } catch { break; }
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }
    rmSync(root, { recursive: true, force: true });
  }
}, 30000);
