import { CliIO, CliDeps, createDefaultDeps } from './client';
import { RegistrationInput } from '@zhon/contracts';

function formatSanitizedError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.replace(/token=[^&\s]+/gi, 'token=[REDACTED]');
}

export async function runCli(args: string[], io: CliIO, deps: CliDeps): Promise<number> {
  if (args.length === 0) {
    io.err('Error: No command specified');
    return 2;
  }

  const cmd = args[0];

  if (cmd === 'start') {
    try {
      try {
        const client = await deps.connect();
        const health = await client.health();
        if (health.ready) {
          io.out('Runtime is already running and healthy');
          return 0;
        }
      } catch {
        // Not running yet, proceed to start
      }

      await deps.startManagedRuntime();
      io.out('Runtime started successfully');
      return 0;
    } catch (err: unknown) {
      io.err(`Error: ${formatSanitizedError(err)}`);
      return 1;
    }
  }

  if (cmd === 'status') {
    try {
      const client = await deps.connect();
      const health = await client.health();
      if (health.ready) {
        io.out('Runtime is healthy and ready');
        return 0;
      } else {
        io.err('Runtime is not ready');
        return 1;
      }
    } catch (err: unknown) {
      io.err(`Error: ${formatSanitizedError(err)}`);
      return 1;
    }
  }

  if (cmd === 'project' && args[1] === 'register') {
    const root = args[2];
    if (!root) {
      io.err('Error: Missing project path');
      return 1;
    }
    try {
      const client = await deps.connect();
      const input: RegistrationInput = { root };
      const res = await client.registerProject(input);
      if (res.ok) {
        io.out(`Project registered successfully: ${res.value.id}`);
        return 0;
      } else {
        io.err(`Error: ${res.error.message}`);
        return 1;
      }
    } catch (err: unknown) {
      io.err(`Error: ${formatSanitizedError(err)}`);
      return 1;
    }
  }

  if (cmd === 'vault' && args[1] === 'register') {
    const root = args[2];
    if (!root) {
      io.err('Error: Missing vault path');
      return 1;
    }
    try {
      const client = await deps.connect();
      const input: RegistrationInput = { root };
      const res = await client.registerVault(input);
      if (res.ok) {
        io.out(`Vault registered successfully: ${res.value.id}`);
        return 0;
      } else {
        io.err(`Error: ${res.error.message}`);
        return 1;
      }
    } catch (err: unknown) {
      io.err(`Error: ${formatSanitizedError(err)}`);
      return 1;
    }
  }

  io.err(`Error: Unknown command: ${cmd}`);
  return 2;
}

if (require.main === module || (typeof process !== 'undefined' && process.argv[1]?.endsWith('main.ts'))) {
  const args = process.argv.slice(2);
  const io: CliIO = {
    out: (text: string) => console.log(text),
    err: (text: string) => console.error(text)
  };
  const deps = createDefaultDeps();
  runCli(args, io, deps).then(code => process.exit(code));
}

