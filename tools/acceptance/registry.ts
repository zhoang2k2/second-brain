export interface CheckRecord {
  name: string;
  status: 'PASS' | 'FAIL' | 'BLOCKED';
  evidencePath?: string;
  evidenceHash?: string;
  reason?: string;
}

export type CheckFn = (profile: unknown) => Promise<CheckRecord>;

export interface RegisteredCheck {
  phaseId: string;
  name: string;
  check: CheckFn;
}

const checks: RegisteredCheck[] = [];

export function registerCheck(phaseId: string, name: string, check: CheckFn): void {
  checks.push({ phaseId, name, check });
}

export function getRegisteredPhases(): string[] {
  return Array.from(new Set(checks.map(c => c.phaseId)));
}

export function getCheckCount(phaseId?: string): number {
  if (!phaseId) return checks.length;
  return checks.filter(c => c.phaseId.toUpperCase() === phaseId.toUpperCase()).length;
}

export async function runChecks(phaseId?: string, profile?: unknown): Promise<CheckRecord[]> {
  const targetChecks = phaseId
    ? checks.filter(c => c.phaseId.toUpperCase() === phaseId.toUpperCase())
    : checks;

  const records: CheckRecord[] = [];
  for (const rc of targetChecks) {
    try {
      const res = await rc.check(profile || {});
      records.push(res);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      records.push({
        name: rc.name,
        status: 'FAIL',
        reason: msg
      });
    }
  }
  return records;
}
