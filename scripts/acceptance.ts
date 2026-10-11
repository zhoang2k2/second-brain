import { runChecks, getCheckCount } from '../tools/acceptance/registry';
import '../tools/acceptance/checks/p0';
import '../tools/acceptance/checks/p1';
import '../tools/acceptance/checks/s1';
import { sourceFingerprint } from '../tools/acceptance/evidence';
import { loadTestProfile } from '../tools/acceptance/profile';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

interface ParsedArgs {
  phase?: string;
  profile?: string;
  run?: string;
}

export function parseCliArgs(args: string[]): ParsedArgs {
  const result: ParsedArgs = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--run' && i + 1 < args.length) {
      result.run = args[++i];
    } else if (arg === '--profile' && i + 1 < args.length) {
      result.profile = args[++i];
    } else if (arg.startsWith('--profile=')) {
      result.profile = arg.slice(10);
    } else if (arg === '--phase' && i + 1 < args.length) {
      result.phase = args[++i];
    } else if (!arg.startsWith('-') && !result.phase) {
      result.phase = arg;
    }
  }
  return result;
}

export async function runAcceptance(argv: string[]): Promise<number> {
  const args = parseCliArgs(argv);
  const phase = args.phase;
  const profileName = args.profile || 'fixture-local';

  if (!phase) {
    console.error('Error: Missing required phase argument. Example: pnpm acceptance -- P0 --profile fixture-local');
    return 1;
  }

  const profile = loadTestProfile(profileName);
  if (!profile) {
    console.error(`Error: Unknown profile ${profileName}`);
    return 1;
  }
  if (args.run && !/^[a-zA-Z0-9_-]+$/.test(args.run)) return 1;

  const matchingCount = getCheckCount(phase);
  if (matchingCount === 0) {
    console.error(`Error: Unknown phase "${phase}" or zero matching checks found.`);
    return 1;
  }

  console.log(`Running acceptance checks for phase ${phase} with profile ${profileName} (${matchingCount} checks registered)...`);
  const records = await runChecks(phase, profile);

  if (args.run) {
    const directory = resolve('docs', 'reports', phase, args.run);
    mkdirSync(directory, { recursive: true });
    writeFileSync(resolve(directory, 'acceptance.json'), JSON.stringify({ phase, run: args.run, profile: profileName, observedAt: new Date().toISOString(), sourceHash: sourceFingerprint(), records }, null, 2) + '\n');
  }

  console.log('Acceptance records:');
  for (const r of records) {
    console.log(`  - [${r.status}] ${r.name}${r.reason ? ` (${r.reason})` : ''}`);
  }

  const hasBlocked = records.some(r => r.status === 'BLOCKED');
  const hasFail = records.some(r => r.status === 'FAIL');

  if (hasBlocked) {
    console.error('Acceptance run BLOCKED on one or more prerequisites.');
    return 1;
  }

  if (hasFail) {
    console.error('Acceptance run FAILED on one or more checks.');
    return 1;
  }

  console.log(`Acceptance completed successfully: all ${records.length} checks PASS.`);
  return 0;
}

if (require.main === module || (typeof process !== 'undefined' && process.argv[1]?.endsWith('acceptance.ts'))) {
  runAcceptance(process.argv.slice(2)).then(code => process.exit(code)).catch(err => {
    console.error('Fatal acceptance error:', err);
    process.exit(1);
  });
}
