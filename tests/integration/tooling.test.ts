import { describe, it, expect } from 'vitest';
import { writePhaseReports } from '../../scripts/report';
import { runAcceptance } from '../../scripts/acceptance';
import {
  validProjectFixture,
  validVaultFixture,
  validHealthFixture,
  apiErrorFixture
} from '../../packages/contracts/src/index';

describe('tooling integration tests', () => {
  it('phase_reports_keep_blocked_result', async () => {
    const report = await writePhaseReports('p0', 'test-run', [
      { name: 'sample_check', status: 'BLOCKED', reason: 'Missing prerequisite' }
    ]);
    expect(report.result).toBe('Blocked');
    expect(report.agentPath.endsWith('agent.md')).toBe(true);
    expect(report.userPath.endsWith('user.vi.md')).toBe(true);
  });

  it('final_report_without_recorded_checks_is_blocked', async () => {
    const report = await writePhaseReports('P0', 'missing-checks-regression');
    expect(report.result).toBe('Blocked');
  });

  it('empty_checks_cannot_mark_done', async () => {
    const report = await writePhaseReports('P0', 'empty-checks', []);
    expect(report.result).toBe('Blocked');
  });

  it('claimed_pass_without_artifacts_cannot_mark_done', async () => {
    const report = await writePhaseReports('P0', 'unbacked-pass-regression', ['local_verify', 'browser_e2e', 'acceptance_p0', 'independent_review'].map(name => ({ name, status: 'PASS' as const })));
    expect(report.result).toBe('Blocked');
  });

  it('verifies cross-package contract fixtures', () => {
    expect(validProjectFixture.id).toBeDefined();
    expect(validVaultFixture.id).toBeDefined();
    expect(validHealthFixture.ready).toBe(true);
    expect(apiErrorFixture.retryable).toBe(false);
  });

  it('unknown_profile_cannot_pass', async () => {
    expect(await runAcceptance(['P0', '--profile', 'not-configured'])).toBe(1);
  });

  it('tooling_fails_on_no_matching_tests', async () => {
    const exitCodeUnknown = await runAcceptance(['UNKNOWN_PHASE']);
    expect(exitCodeUnknown).toBe(1);

    const exitCodeMissing = await runAcceptance([]);
    expect(exitCodeMissing).toBe(1);
  });
});
