import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { sourceFingerprint, artifactFingerprint } from '../tools/acceptance/evidence';
import type { CheckRecord } from '../tools/acceptance/registry';
import { writePhaseReports } from './report';

async function main() {
  const run = process.argv[2] || 'run-p0-remediation';
  if (!/^[a-zA-Z0-9_-]+$/.test(run)) throw new Error('Invalid run identifier');
  const directory = resolve('docs/reports/P0', run);
  mkdirSync(directory, { recursive: true });
  const hashBefore = sourceFingerprint();
  const head = spawnSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).stdout.trim();
  const branch = spawnSync('git', ['branch', '--show-current'], { encoding: 'utf8' }).stdout.trim();
  const baseline = `${branch || 'detached'} @ ${head || 'unknown'}; existing uncommitted workspace preserved`;
  const checks: CheckRecord[] = [];
  const commands: Array<[string, string[]]> = [
    ['local_verify', ['verify']],
    ['browser_e2e', ['test:e2e']],
    ['acceptance_p0', ['acceptance', '--', 'P0', '--profile', 'fixture-local', '--run', run]],
  ];
  for (const [name, argumentsList] of commands) {
    console.log(`Running ${name}: pnpm ${argumentsList.join(' ')}`);
    const outcome = spawnSync('pnpm', argumentsList, { encoding: 'utf8' });
    const evidencePath = resolve(directory, `${name}.log`);
    writeFileSync(evidencePath, `${outcome.stdout ?? ''}${outcome.stderr ?? ''}\nexit_code: ${outcome.status}\n`);
    checks.push({ name, status: outcome.status === 0 ? 'PASS' : 'FAIL', evidencePath, evidenceHash: artifactFingerprint(evidencePath), reason: outcome.status === 0 ? undefined : `Command exit ${outcome.status}` });
    console.log(`${name}: ${checks.at(-1)?.status}`);
    if (outcome.status !== 0) break;
  }
  const hashAfter = sourceFingerprint();
  if (hashBefore !== hashAfter) checks.push({ name: 'source_stable_during_validation', status: 'BLOCKED', reason: 'Source changed during validation' });
  const reviewPath = resolve(directory, 'review.json');
  if (existsSync(reviewPath)) {
    const review = JSON.parse(readFileSync(reviewPath, 'utf8'));
    checks.push({ name: 'independent_review', status: review.status === 'PASS' && review.sourceHash === hashAfter ? 'PASS' : 'BLOCKED', evidencePath: reviewPath, evidenceHash: artifactFingerprint(reviewPath), reason: review.sourceHash !== hashAfter ? 'Review does not match current source' : undefined });
  }
  writeFileSync(resolve(directory, 'checks.json'), JSON.stringify({ phase: 'P0', run, observedAt: new Date().toISOString(), sourceHash: hashAfter, baseline, checks }, null, 2) + '\n');
  const report = await writePhaseReports('P0', run);
  console.log(`Report result: ${report.result}`);
  if (report.result !== 'DoneLocal') process.exitCode = 1;
}
main().catch(error => { console.error(error); process.exitCode = 1; });
