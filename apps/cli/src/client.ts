import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { spawn } from 'node:child_process';
import { Health, Project, Vault, RegistrationInput, Result, Command } from '@zhon/contracts';

export interface CliIO {
  out(text: string): void;
  err(text: string): void;
}

export interface ApiClient {
  health(): Promise<Health>;
  registerProject(input: RegistrationInput): Promise<Result<Project>>;
  registerVault(input: RegistrationInput): Promise<Result<Vault>>;
}

export interface CliDeps {
  connect(): Promise<ApiClient>;
  startManagedRuntime(): Promise<void>;
}

export interface CliDepsOptions {
  runtimeUrl?: string;
  stateFilePath?: string;
  runtimeScriptPath?: string;
  pollIntervalMs?: number;
  startupTimeoutMs?: number;
}

export function createDefaultDeps(options: CliDepsOptions = {}): CliDeps {
  const runtimeUrl = options.runtimeUrl || process.env.ZHON_RUNTIME_URL || 'http://127.0.0.1:4100';
  const stateFilePath =
    options.stateFilePath ||
    process.env.ZHON_RUNTIME_STATE ||
    path.join(os.homedir(), '.zhon', 'runtime.json');
  const runtimeScript =
    options.runtimeScriptPath ||
    process.env.ZHON_RUNTIME_SCRIPT ||
    path.resolve(__dirname, '../../runtime/src/main.ts');
  const pollIntervalMs = options.pollIntervalMs ?? 100;
  const startupTimeoutMs = options.startupTimeoutMs ?? 5000;

  let cachedSessionId: string | null = null;

  async function getSessionToken(): Promise<string> {
    if (cachedSessionId) return cachedSessionId;

    if (!fs.existsSync(stateFilePath)) {
      throw new Error(`Runtime state file not found at ${stateFilePath}`);
    }

    const stateRaw = fs.readFileSync(stateFilePath, 'utf-8');
    const state = JSON.parse(stateRaw);
    const sessionPath = `${stateFilePath}.cli-session`;
    if (fs.existsSync(sessionPath)) {
      const saved = JSON.parse(fs.readFileSync(sessionPath, 'utf8'));
      if (saved.runtimeId === state.bootstrapCode && saved.runtimeUrl === runtimeUrl && saved.expiresAt > Date.now()) {
        cachedSessionId = saved.sessionId;
        return saved.sessionId;
      }
    }
    const bootstrapCode = state.bootstrapCode;
    if (!bootstrapCode) {
      throw new Error('No bootstrap code found in runtime state file');
    }

    const res = await fetch(`${runtimeUrl}/v1/session/bootstrap`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        origin: runtimeUrl
      },
      body: JSON.stringify({ bootstrapCode }),
      signal: AbortSignal.timeout(3000)
    });

    if (!res.ok) {
      throw new Error(`Failed to bootstrap session: HTTP ${res.status}`);
    }

    const data = await res.json();
    if (!data.ok) {
      throw new Error(`Session bootstrap failed: ${data.error.message}`);
    }

    cachedSessionId = data.value.sessionId;
    fs.writeFileSync(sessionPath, JSON.stringify({
      runtimeId: state.bootstrapCode,
      runtimeUrl,
      sessionId: cachedSessionId,
      expiresAt: Date.now() + 24 * 60 * 60 * 1000,
    }), { mode: 0o600 });
    fs.chmodSync(sessionPath, 0o600);
    return cachedSessionId as string;
  }

  const connect = async (): Promise<ApiClient> => {
    // 1. Probe health first to ensure runtime is alive
    const healthRes = await fetch(`${runtimeUrl}/v1/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(3000)
    });

    if (!healthRes.ok) {
      throw new Error(`Runtime unhealthy: HTTP ${healthRes.status}`);
    }

    return {
      health: async (): Promise<Health> => {
        const res = await fetch(`${runtimeUrl}/v1/health`, {
          method: 'GET',
          signal: AbortSignal.timeout(3000)
        });
        if (!res.ok) throw new Error(`Health check failed: HTTP ${res.status}`);
        return await res.json();
      },

      registerProject: async (input: RegistrationInput): Promise<Result<Project>> => {
        const sessionId = await getSessionToken();
        const cmd: Command<RegistrationInput> = {
          requestId: `cli-${Date.now()}`,
          idempotencyKey: `cli-proj-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          payload: input
        };
        const res = await fetch(`${runtimeUrl}/v1/commands/registerProject`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            authorization: `Bearer ${sessionId}`,
            origin: runtimeUrl
          },
          body: JSON.stringify(cmd),
          signal: AbortSignal.timeout(3000)
        });
        return await res.json();
      },

      registerVault: async (input: RegistrationInput): Promise<Result<Vault>> => {
        const sessionId = await getSessionToken();
        const cmd: Command<RegistrationInput> = {
          requestId: `cli-${Date.now()}`,
          idempotencyKey: `cli-vault-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          payload: input
        };
        const res = await fetch(`${runtimeUrl}/v1/commands/registerVault`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            authorization: `Bearer ${sessionId}`,
            origin: runtimeUrl
          },
          body: JSON.stringify(cmd),
          signal: AbortSignal.timeout(3000)
        });
        return await res.json();
      }
    };
  };

  const startManagedRuntime = async (): Promise<void> => {
    // 1. Idempotency check: if runtime is already running and ready, do not spawn twice
    try {
      const client = await connect();
      const health = await client.health();
      if (health.ready) {
        return;
      }
    } catch {
      // Runtime is not running, proceed to spawn
    }

    const tsxBin = path.resolve(__dirname, '../../../node_modules/.bin/tsx');
    const port = new URL(runtimeUrl).port || '4100';

    const child = spawn(tsxBin, [runtimeScript], {
      detached: true,
      stdio: 'ignore',
      env: {
        ...process.env,
        ZHON_PORT: port,
        ZHON_RUNTIME_STATE: stateFilePath
      }
    });

    let spawnError: Error | undefined;
    child.on('error', error => { spawnError = error; });
    child.unref();

    // 2. Poll health until ready or timeout
    const startTime = Date.now();
    while (Date.now() - startTime < startupTimeoutMs) {
      if (spawnError) throw spawnError;
      if (child.exitCode !== null) throw new Error(`Runtime exited during startup (${child.exitCode})`);
      try {
        const client = await connect();
        const health = await client.health();
        if (health.ready) {
          return;
        }
      } catch {
        // Retry
      }
      await new Promise(r => setTimeout(r, pollIntervalMs));
    }

    throw new Error('Runtime failed to become ready within timeout');
  };

  return {
    connect,
    startManagedRuntime
  };
}
