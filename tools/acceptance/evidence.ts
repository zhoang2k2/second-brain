import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

export function sourceFingerprint(root = process.cwd()): string {
  const hash = createHash('sha256');
  const ignored = new Set(['node_modules', '.next', 'test-results', '.git']);
  const visit = (target: string) => {
    if (!existsSync(target)) return;
    if (statSync(target).isDirectory()) {
      for (const name of readdirSync(target).sort()) {
        if (!ignored.has(name)) visit(join(target, name));
      }
      return;
    }
    if (/tsbuildinfo$|next-env\.d\.ts$/.test(target)) return;
    hash.update(relative(root, target));
    hash.update(readFileSync(target));
  };
  for (const name of ['apps', 'packages', 'scripts', 'tools', 'tests', '.github', 'package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml', 'tsconfig.json', 'vitest.config.ts', 'vitest.setup.ts', 'playwright.config.ts', 'eslint.config.mjs', 'AGENTS.md', '.node-version', 'README.md', 'docs/conventions', 'docs/reports/P0/toolchain-qualification.md']) {
    visit(join(root, name));
  }
  return hash.digest('hex');
}

export function artifactFingerprint(file: string): string {
  return createHash('sha256').update(readFileSync(file)).digest('hex');
}
