import { it, expect } from 'vitest';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';

it('concurrent_processes_get_exactly_one_database_owner', async () => {
  const root = mkdtempSync(join(tmpdir(), 'zhon-owner-race-'));
  const children = Array.from({ length: 3 }, () => spawn(resolve('node_modules/.bin/tsx'), [resolve('tests/integration/fixtures/store-owner.ts'), join(root, 'state.db')], { stdio: ['pipe', 'pipe', 'pipe'] }));
  try {
    const outputs = children.map(() => '');
    const completed = children.map((child, index) => new Promise<void>((done, reject) => {
      child.on('error', reject);
      child.stdout.on('data', chunk => { outputs[index] += String(chunk); });
      child.once('exit', code => code === 0 ? done() : reject(new Error(`Owner probe exited ${code}`)));
    }));
    await Promise.all(children.map((child, index) => new Promise<void>(ready => {
      if (outputs[index].includes('READY')) return ready();
      const onData = () => { if (outputs[index].includes('READY')) { child.stdout.off('data', onData); ready(); } };
      child.stdout.on('data', onData);
    })));
    children.forEach(child => child.stdin.write('open\n'));
    await Promise.all(completed);
    expect(outputs.filter(output => output.includes('OWNER'))).toHaveLength(1);
    expect(outputs.filter(output => output.includes('DENIED'))).toHaveLength(2);
  } finally {
    children.forEach(child => { if (child.exitCode === null) child.kill('SIGTERM'); });
    rmSync(root, { recursive: true, force: true });
  }
}, 15000);
