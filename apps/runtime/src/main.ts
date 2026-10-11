import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { openStore } from './storage/database';
import { createServer } from './server/create-server';
import { RegisteredRootPolicy } from './adapters/filesystem/registered-paths';
import { LocalSessionManager } from './server/local-session';

async function main() {
  const dbPath = process.env.ZHON_DB_PATH || path.join(os.homedir(), '.zhon', 'zhon.db');
  const port = parseInt(process.env.ZHON_PORT || '4100', 10);
  const host = '127.0.0.1'; // Enforce loopback binding only

  const allowedOrigins = process.env.ZHON_ALLOWED_ORIGINS
    ? process.env.ZHON_ALLOWED_ORIGINS.split(',').map(s => s.trim())
    : ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://localhost:4100', 'http://127.0.0.1:4100'];

  const allowedRoots = process.env.ZHON_ALLOWED_ROOTS
    ? process.env.ZHON_ALLOWED_ROOTS.split(',').map(s => s.trim())
    : undefined;

  const store = openStore(dbPath);
  const policy = new RegisteredRootPolicy(allowedRoots);
  const clock = () => new Date().toISOString();

  const sessionManager = new LocalSessionManager({
    allowedOrigins,
    requireSession: true
  });
  const bootstrapCode = sessionManager.generateBootstrapCode('cli');
  const browserBootstrapCode = sessionManager.generateBootstrapCode();

  const server = await createServer({
    store,
    clock,
    registeredRootPolicy: policy,
    localSessionConfig: {
      allowedOrigins,
      requireSession: true
    },
    sessionManager
  });

  const address = await server.listen({ host, port });
  console.log(`Zhon runtime listening on ${address}`);

  const zhonDir = path.dirname(dbPath);
  fs.mkdirSync(zhonDir, { recursive: true });
  const runtimeInfoPath = process.env.ZHON_RUNTIME_STATE || path.join(zhonDir, 'runtime.json');
  fs.writeFileSync(
    runtimeInfoPath,
    JSON.stringify(
      {
        pid: process.pid,
        port,
        host,
        bootstrapCode,
        browserBootstrapCode,
        startedAt: new Date().toISOString()
      },
      null,
      2
    ),
    { mode: 0o600 }
  );

  fs.chmodSync(runtimeInfoPath, 0o600);

  const shutdown = async () => {
    console.log('Shutting down Zhon runtime...');
    try {
      if (fs.existsSync(runtimeInfoPath)) {
        fs.unlinkSync(runtimeInfoPath);
      }
    } catch {
      // Ignore
    }
    try {
      await server.close();
    } catch {
      // Ignore
    }
    try {
      store.close();
    } catch {
      // Ignore
    }
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

if (require.main === module || process.env.ZHON_START === 'true') {
  main().catch(err => {
    console.error('Fatal error starting Zhon runtime:', err);
    process.exit(1);
  });
}

export { main };
