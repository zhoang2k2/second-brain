import * as fs from 'node:fs';
import * as path from 'node:path';
import { sourceFingerprint, artifactFingerprint } from '../tools/acceptance/evidence';
import type { CheckRecord } from '../tools/acceptance/registry';

export type LifecycleResult = 'DoneLocal' | 'Blocked' | 'Failed' | 'Cancelled' | 'RecoveryRequired';
interface PhaseConfig {
  requiredGates: string[];
  objective: string;
  planVersion: string;
  delivered: string[];
  decisions: string[];
  next: string;
  userSummary: string;
  exampleExplanation: string;
}

const PHASE_CONFIGS: Record<string, PhaseConfig> = {
  P0: {
    requiredGates: ['local_verify', 'browser_e2e', 'acceptance_p0', 'independent_review'],
    objective: 'Protected local runtime, persistent registration, browser shell and CLI lifecycle.',
    planVersion: '2026-10-10-p0-foundation',
    delivered: [
      'Runtime/CLI lifecycle and browser bootstrap implementations; acceptance status is recorded below.',
      'Canonical filesystem scope and atomic SQLite owner enforcement.',
      'Durable validation/report artifacts bound to current source.'
    ],
    decisions: [
      'CLI bearer and browser HttpOnly cookie use separate session audiences.',
      'Ambiguous stale locks require deliberate recovery; no silent lock takeover.'
    ],
    next: 'P1 planning handoff',
    userSummary: 'P0 sẵn sàng bàn giao P1.',
    exampleExplanation: 'Session xác thực quyền gửi mutation đến runtime. Ví dụ: CLI đăng ký project rồi đăng ký vault ở hai process riêng phải dùng được session đã lưu; browser dùng bootstrap riêng qua form Connect runtime.'
  },
  P1: {
    requiredGates: ['local_verify', 'browser_e2e', 'acceptance_p1', 'independent_review'],
    objective: 'Obsidian Markdown ingestion, immutable revision store, atomic CAS review, scoped search and FTS5 retrieval.',
    planVersion: '2026-10-10-p1-knowledge-review',
    delivered: [
      'Knowledge contracts, schema migration 002 (notes, revisions, candidates, promotions, notes_fts).',
      'Vault scanning, 1 MiB size cap, SHA-256 deduplication and canonical RegisteredRootPolicy enforcement.',
      'Atomic CAS approve/reject review operations with STALE_CANDIDATE conflict rejection.',
      'Scope-first retrieval ensuring private project notes are never leaked across projects.',
      'Three-column UI (Active, Candidate, Deactive) with diff review and full accessible controls.'
    ],
    decisions: [
      'Content-addressable revision snapshots keyed by SHA-256 with 1 MiB size cap and canonical path scope enforcement.',
      'Atomic CAS review: stale candidate version or source hash refuses approval with STALE_CANDIDATE.',
      'Scope-first retrieval strictly confines searches; private project notes are never leaked across projects.'
    ],
    next: 'P2 chat context consuming retrieveActive and exact immutable approved revision IDs; P3 consumes the Candidate/review pipeline',
    userSummary: 'P1 hoàn tất xác thực và sẵn sàng cho P2.',
    exampleExplanation: 'Quy trình kiểm duyệt ghi chú (Knowledge review): Khi một file Markdown trong vault thay đổi, hệ thống tạo bản ghi Candidate mới. Người dùng duyệt phiên bản này trên UI 3 cột; sau khi Approve bằng atomic CAS, ghi chú chuyển sang cột Active và được lập chỉ mục tìm kiếm FTS5.'
  },
  S1: {
    requiredGates: ['local_verify', 'acceptance_s1', 'qualification_artifacts', 'independent_review'],
    objective: 'macOS sandbox feasibility, process group confinement, Codex CLI & Antigravity CLI capability qualification, and Go/No-Go decision.',
    planVersion: '2026-10-10-s1-sandbox-feasibility',
    delivered: [
      'Sandbox isolation probe harness verifying filesystem, process, secret, and network boundaries.',
      'Child process tree termination via process group signaling (-pid SIGKILL) leaving zero orphaned descendants.',
      'Engine qualification: Codex CLI (0.162.0) qualified with loopback proxy; Antigravity CLI (1.3.3) marked UNSUPPORTED for autonomous execution.',
      'Go/No-Go decision matrix: unconfined AUTO execution blocked; Human-in-the-loop approval or pre-approved budgets required.'
    ],
    decisions: [
      'Tree process kill uses process group signaling (-pid SIGKILL) guaranteeing zero orphaned descendants.',
      'Truthful Evaluation: Antigravity CLI is marked UNSUPPORTED for autonomous execution; Codex is conditionally qualified requiring loopback HTTP broker.',
      'Unconfined autonomous execution is blocked for Phase P4; Human-in-the-loop approval or pre-approved budgets required.'
    ],
    next: 'P4 sandbox configuration consuming S1 capability manifests',
    userSummary: 'S1 hoàn tất khảo sát sandbox feasibility và ma trận đánh giá engine.',
    exampleExplanation: 'Khảo sát giới hạn an toàn (Sandbox Feasibility): Kiểm tra khả năng cô lập tiến trình và bảo vệ file nhạy cảm trên macOS. Quyết định Go/No-Go: Không cho phép agent tự động thực thi tùy tiện trong P4; mọi hành động mạng hoặc ghi file ngoài phạm vi đều phải được người dùng phê duyệt.'
  }
};

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
  const config = PHASE_CONFIGS[phaseId] || {
    requiredGates: ['local_verify', 'independent_review'],
    objective: `Phase ${phaseId} execution and verification.`,
    planVersion: `2026-10-10-${phaseId.toLowerCase()}`,
    delivered: ['Delivered components and acceptance checks.'],
    decisions: ['Standard architectural decisions.'],
    next: 'Subsequent phase handoff',
    userSummary: `${phaseId} hoàn tất.`,
    exampleExplanation: `${phaseId} hoàn tất các mục tiêu đề ra.`
  };

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
    if (check.status !== 'PASS' || !config.requiredGates.includes(check.name)) return check;
    if (!check.evidencePath || !fs.existsSync(check.evidencePath) || !check.evidenceHash || artifactFingerprint(check.evidencePath) !== check.evidenceHash) {
      return { ...check, status: 'BLOCKED', reason: 'Required evidence artifact is missing or changed' };
    }
    return check;
  });
  if (checks.some(check => !check.name || !['PASS', 'FAIL', 'BLOCKED'].includes(check.status))) {
    throw new Error('Invalid check record');
  }
  const missing = config.requiredGates.filter(name => !checks.some(check => check.name === name));
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
  fs.writeFileSync(agentPath, `# Phase report\n\nphase: ${phaseId}\nrun: ${runId}\nresult: ${result}\nobjective: ${config.objective}
plan_version: ${config.planVersion}
baseline: ${baseline}
observed_at: ${observedAt}
source_hash: ${sourceHash}
delivered:
${config.delivered.map(d => `- ${d}`).join('\n')}
artifacts:
- ${evidencePath}
${allChecks.filter(check => check.evidencePath).map(check => `- ${check.evidencePath}; sha256=${check.evidenceHash ?? 'unknown'}`).join('\n')}
decisions:
${config.decisions.map(d => `- ${d}`).join('\n')}
evidence: ${evidencePath}\n\nchecks:\n${rows.map(row => `- ${row}`).join('\n')}\n\nblockers:\n${blockers.length ? blockers.map(item => `- ${item}; resolver: integrator/reviewer; action: resolve gate and rerun validation`).join('\n') : '- none'}\n\nnext: ${result === 'DoneLocal' ? config.next : 'Resolve required gates and rerun validation'}\nremote_ci: Not verified; no commit or push performed.\n`);
  fs.writeFileSync(userPath, `# Báo cáo ${phaseId}\n\nKết quả: **${result}**\nRun: ${runId}\n\n| Gate | Kết quả | Evidence / lý do |\n| --- | --- | --- |\n${allChecks.map(check => `| ${check.name} | ${check.status} | ${[check.evidencePath, check.reason].filter(Boolean).join('; ')} |`).join('\n')}\n\n${config.exampleExplanation}\n\nDoneLocal chỉ chứng minh local gates có recorded evidence. Remote CI chưa được xác minh; source chưa commit/push.\n${result === 'DoneLocal' ? config.userSummary : `${phaseId} còn required gates chưa đạt; chưa sẵn sàng chuyển tiếp.`}\n`);
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
