import * as fs from 'node:fs';
import * as path from 'node:path';
import { sourceFingerprint, artifactFingerprint } from '../tools/acceptance/evidence';
import type { CheckRecord } from '../tools/acceptance/registry';

export type LifecycleResult = 'DoneLocal' | 'Blocked' | 'Failed' | 'Cancelled' | 'RecoveryRequired';
const requiredGates = ['local_verify', 'browser_e2e', 'acceptance_p0', 'independent_review'];

export function parseReportArgs(argv: string[]): { phase: string; run: string } {
  let phase = 'P0';
  let run = 'run-p0-final';
  for (let index = 0; index < argv.length; index++) {
    const argument = argv[index];
    if (argument === '--phase') phase = argv[++index];
    else if (argument === '--run') run = argv[++index];
    else if (argument.startsWith('--phase=')) phase = argument.slice(8);
    else if (argument.startsWith('--run=')) run = argument.slice(6);
    else if (!argument.startsWith('-') && argument !== '--') phase = argument;
  }
  return { phase, run };
}

export async function writePhaseReports(
  phaseId: string,
  runId: string,
  records?: CheckRecord[]
): Promise<{ result: LifecycleResult; agentPath: string; userPath: string }> {
  if (!/^[a-zA-Z0-9_-]+$/.test(phaseId) || !/^[a-zA-Z0-9_-]+$/.test(runId)) {
    throw new Error('Invalid phase or run identifier');
  }
  const directory = path.resolve('docs', 'reports', phaseId, runId);
  fs.mkdirSync(directory, { recursive: true });
  const evidencePath = path.join(directory, 'checks.json');
  let sourceHash = 'unknown';
  let baseline = 'unknown; no validation metadata';
  let observedAt = 'unknown';
  let checks: CheckRecord[] = records ?? [];
  if (records) checks = [...checks, { name: 'recorded_source', status: 'BLOCKED', reason: 'Completion requires persisted, source-bound checks.json' }];
  if (!records && fs.existsSync(evidencePath)) {
    const stored = JSON.parse(fs.readFileSync(evidencePath, 'utf8'));
    if (stored.phase !== phaseId || stored.run !== runId || !Array.isArray(stored.checks)) {
      throw new Error('Recorded evidence does not match phase/run');
    }
    checks = stored.checks;
    sourceHash = stored.sourceHash;
    baseline = stored.baseline ?? baseline;
    observedAt = stored.observedAt ?? observedAt;
    if (stored.sourceHash !== sourceFingerprint()) {
      checks = [...checks, { name: 'source_evidence_current', status: 'BLOCKED', reason: 'Source changed since validation; rerun required' }];
    }
  }
  checks = checks.map(check => {
    if (check.status !== 'PASS' || !requiredGates.includes(check.name)) return check;
    if (!check.evidencePath || !fs.existsSync(check.evidencePath) || !check.evidenceHash || artifactFingerprint(check.evidencePath) !== check.evidenceHash) {
      return { ...check, status: 'BLOCKED', reason: 'Required evidence artifact is missing or changed' };
    }
    return check;
  });
  if (checks.some(check => !check.name || !['PASS', 'FAIL', 'BLOCKED'].includes(check.status))) {
    throw new Error('Invalid check record');
  }
  const missing = requiredGates.filter(name => !checks.some(check => check.name === name));
  const allChecks: CheckRecord[] = [...checks, ...missing.map(name => ({
    name, status: 'BLOCKED' as const, reason: 'Required phase evidence is missing',
  }))];
  const failed = allChecks.some(check => check.status === 'FAIL');
  const blocked = allChecks.some(check => check.status === 'BLOCKED');
  let result: LifecycleResult = 'DoneLocal';
  if (failed) result = 'Failed';
  else if (blocked) result = 'Blocked';
  const rows = allChecks.map(check => `${check.name}: ${check.status}${check.reason ? ` (${check.reason})` : ''}${check.evidencePath ? ` [${check.evidencePath}]` : ''}`);
  const blockers = allChecks.filter(check => check.status !== 'PASS').map(check => `${check.name}: ${check.reason ?? check.status}`);
  const agentPath = path.join(directory, 'agent.md');
  const userPath = path.join(directory, 'user.vi.md');
  fs.writeFileSync(agentPath, `# Phase report\n\nphase: ${phaseId}\nrun: ${runId}\nresult: ${result}\nobjective: Protected local runtime, persistent registration, browser shell and CLI lifecycle.
plan_version: 2026-10-10-p0-foundation
baseline: ${baseline}
observed_at: ${observedAt}
source_hash: ${sourceHash}
delivered:
- Runtime/CLI lifecycle and browser bootstrap implementations; acceptance status is recorded below.
- Canonical filesystem scope and atomic SQLite owner enforcement.
- Durable validation/report artifacts bound to current source.
artifacts:
- ${evidencePath}
${allChecks.filter(check => check.evidencePath).map(check => `- ${check.evidencePath}; sha256=${check.evidenceHash ?? 'unknown'}`).join('\n')}
decisions:
- CLI bearer and browser HttpOnly cookie use separate session audiences.
- Ambiguous stale locks require deliberate recovery; no silent lock takeover.
knowledge_candidates:
- Not generated: Candidate ingestion belongs to P1.
evidence: ${evidencePath}\n\nchecks:\n${rows.map(row => `- ${row}`).join('\n')}\n\nblockers:\n${blockers.length ? blockers.map(item => `- ${item}; resolver: integrator/reviewer; action: resolve gate and rerun validation`).join('\n') : '- none'}\n\nnext: ${result === 'DoneLocal' ? 'P1 planning handoff' : 'Resolve required gates and rerun validation'}\nremote_ci: Not verified; no commit or push performed.\n`);
  fs.writeFileSync(userPath, `# Báo cáo ${phaseId}\n\nKết quả: **${result}**\nRun: ${runId}\n\n| Gate | Kết quả | Evidence / lý do |\n| --- | --- | --- |\n${allChecks.map(check => `| ${check.name} | ${check.status} | ${[check.evidencePath, check.reason].filter(Boolean).join('; ')} |`).join('\n')}\n\nSession xác thực quyền gửi mutation đến runtime. Ví dụ: CLI đăng ký project rồi đăng ký vault ở hai process riêng phải dùng được session đã lưu; browser dùng bootstrap riêng qua form Connect runtime.\n\nDoneLocal chỉ chứng minh local gates có recorded evidence. Remote CI chưa được xác minh; source chưa commit/push.\n${result === 'DoneLocal' ? 'P0 sẵn sàng bàn giao P1.' : 'P0 còn required gates chưa đạt; chưa sẵn sàng chuyển P1.'}\n`);
  return { result, agentPath, userPath };
}

if (process.argv[1]?.endsWith('report.ts')) {
  const { phase, run } = parseReportArgs(process.argv.slice(2));
  writePhaseReports(phase, run).then(report => {
    console.log(`Report generated: ${phase}/${run}, result=${report.result}`);
    if (report.result !== 'DoneLocal') process.exitCode = 1;
  }).catch(error => {
    console.error(error);
    process.exitCode = 1;
  });
}
