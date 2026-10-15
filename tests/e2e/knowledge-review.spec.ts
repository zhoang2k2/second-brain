import { test, expect } from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { FastifyInstance } from 'fastify';
import { createServer } from '../../apps/runtime/src/server/create-server';
import { openStore, Store } from '../../apps/runtime/src/storage/database';
import { RegisteredRootPolicy } from '../../apps/runtime/src/adapters/filesystem/registered-paths';
import { LocalSessionManager } from '../../apps/runtime/src/server/local-session';

interface E2EKnowledgeRuntime {
  server: FastifyInstance;
  store: Store;
  dbPath: string;
  tempDir: string;
  vaultDir: string;
  revisionsDir: string;
  sessionManager: LocalSessionManager;
  bootstrapCode: string;
  restart: () => Promise<void>;
  cleanup: () => Promise<void>;
}

async function startKnowledgeRuntime(): Promise<E2EKnowledgeRuntime> {
  const tempDir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'zhon-e2e-knowledge-')));
  const dbPath = path.join(tempDir, 'knowledge-e2e.db');
  const vaultDir = path.join(tempDir, 'vault');
  const revisionsDir = path.join(tempDir, 'revisions');

  fs.mkdirSync(vaultDir, { recursive: true });
  fs.mkdirSync(revisionsDir, { recursive: true });

  let store = openStore(dbPath);
  const policy = new RegisteredRootPolicy([tempDir]);
  let sessionManager = new LocalSessionManager({
    allowedOrigins: ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://127.0.0.1:4100'],
    requireSession: true
  });
  let bootstrapCode = sessionManager.generateBootstrapCode();

  const clock = () => '2026-10-10T12:00:00Z';

  let server = await createServer({
    store,
    clock,
    registeredRootPolicy: policy,
    localSessionConfig: {
      allowedOrigins: ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://127.0.0.1:4100'],
      requireSession: true
    },
    sessionManager,
    revisionsDir
  });

  await server.listen({ host: '127.0.0.1', port: 4100 });

  const manager: E2EKnowledgeRuntime = {
    server,
    store,
    dbPath,
    tempDir,
    vaultDir,
    revisionsDir,
    sessionManager,
    bootstrapCode,
    restart: async () => {
      try {
        (server.server as unknown as { closeAllConnections?: () => void })?.closeAllConnections?.();
        await server.close();
      } catch {}
      try {
        store.close();
      } catch {}

      store = openStore(dbPath);
      sessionManager = new LocalSessionManager({
        allowedOrigins: ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://127.0.0.1:4100'],
        requireSession: true
      });
      bootstrapCode = sessionManager.generateBootstrapCode();

      server = await createServer({
        store,
        clock,
        registeredRootPolicy: policy,
        localSessionConfig: {
          allowedOrigins: ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://127.0.0.1:4100'],
          requireSession: true
        },
        sessionManager,
        revisionsDir
      });
      await server.listen({ host: '127.0.0.1', port: 4100 });
      manager.server = server;
      manager.store = store;
      manager.sessionManager = sessionManager;
      manager.bootstrapCode = bootstrapCode;
    },
    cleanup: async () => {
      try {
        (server.server as unknown as { closeAllConnections?: () => void })?.closeAllConnections?.();
        await server.close();
      } catch {}
      try {
        store.close();
      } catch {}
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch {}
    }
  };

  return manager;
}

test.describe('Phase P1 Knowledge Review Browser E2E Specification', () => {
  let runtime: E2EKnowledgeRuntime | undefined;

  test.afterEach(async () => {
    if (runtime) {
      await runtime.cleanup();
      runtime = undefined;
    }
  });

  test('browser_candidate_review_approve_and_persist_across_restart', async ({ page }) => {
    runtime = await startKnowledgeRuntime();

    // 1. Create a markdown note in the registered vault
    const noteContent = '# Deployment Runbook\nDetailed steps for zero-downtime deployment and rollback.';
    fs.writeFileSync(path.join(runtime.vaultDir, 'runbook.md'), noteContent, 'utf8');

    // 3. Visit production web page
    await page.goto('/');

    // 4. Authenticate session via bootstrap code
    await page.getByLabel('Bootstrap code').fill(runtime.bootstrapCode);
    await page.getByRole('button', { name: 'Connect runtime', exact: true }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Runtime connected' })).toBeVisible();
    await page.getByLabel('Vault root path').fill(runtime.vaultDir);
    await page.getByRole('button', { name: 'Register Vault', exact: true }).click();
    await expect(page.getByText(runtime.vaultDir, { exact: true })).toBeVisible();

    // 5. Navigate to Knowledge view
    const knowledgeTab = page.getByRole('button', { name: /knowledge/i });
    await knowledgeTab.click();

    // 6. Verify 3-column view is rendered (Active, Candidate, Deactive)
    await expect(page.getByRole('region', { name: 'Candidate notes', exact: true })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Active notes', exact: true })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Deactive notes', exact: true })).toBeVisible();

    // 7. Verify candidate note is visible in Candidate column
    await expect(page.getByText('Deployment Runbook')).toBeVisible();

    // 8. Open review drawer / candidate item if needed
    const approveBtn = page.getByRole('button', { name: 'Approve', exact: true });
    if (!await approveBtn.isVisible()) {
      await page.getByText('Deployment Runbook').click();
    }

    // 9. Approve Candidate
    await expect(approveBtn).toBeVisible();
    await approveBtn.click();

    // 10. Verify note moves to Active column
    const activeColumn = page.getByRole('region', { name: 'Active notes', exact: true });
    await expect(activeColumn.getByText('Deployment Runbook')).toBeVisible();

    // A manual edit must arrive through the real watcher + Next SSE proxy,
    // without direct ingestion calls or a browser reload.
    fs.writeFileSync(path.join(runtime.vaultDir, 'runbook.md'), '# Deployment Runbook\nNew rollout proposal awaiting review.');
    const candidateColumn = page.getByRole('region', { name: 'Candidate notes', exact: true });
    await expect(candidateColumn.getByText('Deployment Runbook')).toBeVisible();
    await expect(activeColumn.getByText('Deployment Runbook')).toBeVisible();
    await candidateColumn.getByRole('button', { name: 'Reject', exact: true }).click();
    await expect(candidateColumn.getByText('Deployment Runbook')).toHaveCount(0);

    // 11. Searchbox filtering
    const searchbox = page.getByRole('searchbox', { name: /search knowledge/i });
    await searchbox.fill('zero-downtime');
    await expect(activeColumn.getByText('Deployment Runbook')).toBeVisible();

    // 12. Restart runtime and reload page
    await runtime.restart();
    await page.reload();

    // Re-authenticate session
    await page.getByLabel('Bootstrap code').fill(runtime.bootstrapCode);
    await page.getByRole('button', { name: 'Connect runtime', exact: true }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Runtime connected' })).toBeVisible();

    // Navigate to Knowledge view
    await page.getByRole('button', { name: /knowledge/i }).click();

    // Verify approved note persists in Active column
    await expect(page.getByRole('region', { name: 'Active notes', exact: true }).getByText('Deployment Runbook')).toBeVisible();
    await page.getByText('Review history', { exact: true }).click();
    const history = page.getByRole('region', { name: 'Review history', exact: true });
    await expect(history.getByText('Deployment Runbook — rejected', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Deactivate note runbook.md', exact: true }).click();
    await expect(page.getByRole('region', { name: 'Deactive notes', exact: true }).getByText('Deployment Runbook')).toBeVisible();
    await history.getByText('Deployment Runbook — approved', { exact: true }).click();
    await history.getByRole('button', { name: /^Restore approved revision/ }).click();
    await expect(page.getByRole('region', { name: 'Active notes', exact: true }).getByText('Deployment Runbook')).toBeVisible();

    fs.writeFileSync(path.join(runtime.vaultDir, 'broken.md'), '---\nzhon_id: "unfinished\n---\n# Broken');
    await expect(page.getByRole('main').getByRole('alert')).toContainText('INCOMPLETE_YAML');
    fs.unlinkSync(path.join(runtime.vaultDir, 'runbook.md'));
    await expect(page.getByRole('region', { name: 'Active notes', exact: true }).getByText('Deployment Runbook')).toHaveCount(0);
    await expect(page.getByRole('region', { name: 'Deactive notes', exact: true }).getByText('Deployment Runbook')).toBeVisible();
  });
});
