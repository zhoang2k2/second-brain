import { test, expect } from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { FastifyInstance } from 'fastify';
import { createServer } from '../../apps/runtime/src/server/create-server';
import { openStore, Store } from '../../apps/runtime/src/storage/database';
import { RegisteredRootPolicy } from '../../apps/runtime/src/adapters/filesystem/registered-paths';
import { LocalSessionManager } from '../../apps/runtime/src/server/local-session';
import { proxyToRuntime, ProxyRequestLike } from '../../apps/web/src/lib/api/proxy';

interface E2ERuntimeManager {
  server: FastifyInstance;
  store: Store;
  dbPath: string;
  tempDir: string;
  allowedDir: string;
  sessionManager: LocalSessionManager;
  bootstrapCode: string;
  restart: () => Promise<void>;
  stop: () => Promise<void>;
  cleanup: () => Promise<void>;
}

async function startE2ERuntime(): Promise<E2ERuntimeManager> {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zhon-e2e-real-'));
  const dbPath = path.join(tempDir, 'e2e.db');
  const allowedDir = path.join(tempDir, 'allowed');
  fs.mkdirSync(allowedDir, { recursive: true });

  let store = openStore(dbPath);
  const policy = new RegisteredRootPolicy([tempDir]);
  let sessionManager = new LocalSessionManager({
    allowedOrigins: ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://127.0.0.1:4100'],
    requireSession: true
  });
  let bootstrapCode = sessionManager.generateBootstrapCode();

  let server = await createServer({
    store,
    clock: () => '2026-10-10T12:00:00Z',
    registeredRootPolicy: policy,
    localSessionConfig: {
      allowedOrigins: ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://127.0.0.1:4100'],
      requireSession: true
    },
    sessionManager
  });

  await server.listen({ host: '127.0.0.1', port: 4100 });

  const manager: E2ERuntimeManager = {
    server,
    store,
    dbPath,
    tempDir,
    allowedDir,
    sessionManager,
    bootstrapCode,
    restart: async () => {
      try {
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
        clock: () => '2026-10-10T12:00:00Z',
        registeredRootPolicy: policy,
        localSessionConfig: {
          allowedOrigins: ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://127.0.0.1:4100'],
          requireSession: true
        },
        sessionManager
      });
      await server.listen({ host: '127.0.0.1', port: 4100 });
      manager.server = server;
      manager.store = store;
      manager.sessionManager = sessionManager;
      manager.bootstrapCode = bootstrapCode;
    },
    stop: async () => {
      try {
        await server.close();
      } catch {}
      try {
        store.close();
      } catch {}
    },
    cleanup: async () => {
      try {
        await server.close();
      } catch {}
      try {
        store.close();
      } catch {}
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  };

  return manager;
}

test.describe('P0 Production Shell & Browser E2E Specification', () => {
  let runtime: E2ERuntimeManager | undefined;

  test.afterEach(async () => {
    if (runtime) {
      await runtime.cleanup();
      runtime = undefined;
    }
  });

  test('browser_registration_survives_runtime_restart_and_page_reload', async ({ page }) => {
    runtime = await startE2ERuntime();
    const disposableProjDir = path.join(runtime.allowedDir, 'proj-browser-e2e');
    const disposableVaultDir = path.join(runtime.allowedDir, 'vault-browser-e2e');
    fs.mkdirSync(disposableProjDir, { recursive: true });
    fs.mkdirSync(disposableVaultDir, { recursive: true });

    // 1. Visit production page
    await page.goto('/');

    // Bootstrap through the same form used by a person, never injected browser state.
    await page.getByLabel('Bootstrap code').fill(runtime.bootstrapCode);
    await page.getByRole('button', { name: 'Connect runtime', exact: true }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Runtime connected' })).toBeVisible();
    const cookie = (await page.context().cookies()).find(item => item.name === 'zhon_session');
    expect(cookie?.httpOnly).toBe(true);
    expect(await page.evaluate(() => document.cookie.includes('zhon_session'))).toBe(false);

    // 3. Register disposable project via UI
    const projectInput = page.getByLabel('Project root path');
    await projectInput.fill(disposableProjDir);
    await page.getByRole('button', { name: 'Register Project' }).click();

    await expect(page.getByText(disposableProjDir)).toBeVisible();

    // 4. Register disposable vault via UI
    const vaultInput = page.getByLabel('Vault root path');
    await vaultInput.fill(disposableVaultDir);
    await page.getByRole('button', { name: 'Register Vault' }).click();

    await expect(page.getByText(disposableVaultDir)).toBeVisible();

    // 5. Restart runtime daemon
    await runtime.restart();

    // 6. Reload browser page
    await page.reload();

    // 7. Verify both registered roots remain visible after restart and reload
    await expect(page.getByText(disposableProjDir)).toBeVisible();
    await expect(page.getByText(disposableVaultDir)).toBeVisible();

    // Restart invalidates old mutation sessions; reconnect through the form.
    const secondProject = path.join(runtime.allowedDir, 'after-restart');
    fs.mkdirSync(secondProject);
    await page.getByLabel('Project root path').fill(secondProject);
    await page.getByRole('button', { name: 'Register Project' }).click();
    await expect(page.getByRole('main').getByRole('alert')).toContainText('Invalid or expired local session');
    await page.getByLabel('Bootstrap code').fill(runtime.bootstrapCode);
    await page.getByRole('button', { name: 'Connect runtime', exact: true }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Runtime connected' })).toBeVisible();
    await page.getByRole('button', { name: 'Register Project' }).click();
    await expect(page.getByText(secondProject)).toBeVisible();
  });

  test('browser_keyboard_navigation_and_theme_persistence', async ({ page }) => {
    await page.goto('/');

    // 1. Theme toggle: select Dark
    const darkBtn = page.getByRole('button', { name: 'Dark' });
    await darkBtn.click();
    await expect(darkBtn).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('html[data-theme="dark"]')).toBeVisible();

    // 2. Reload browser: verify theme persistence
    await page.reload();
    await expect(page.getByRole('button', { name: 'Dark' })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('html[data-theme="dark"]')).toBeVisible();

    // 3. Keyboard navigation: Toggle groups using keyboard
    const personalGroupBtn = page.getByRole('button', { name: 'PERSONAL' });
    await expect(personalGroupBtn).toHaveAttribute('aria-expanded', 'true');
    await personalGroupBtn.focus();
    await page.keyboard.press('Enter');
    await expect(personalGroupBtn).toHaveAttribute('aria-expanded', 'false');

    await page.keyboard.press('Space');
    await expect(personalGroupBtn).toHaveAttribute('aria-expanded', 'true');
  });

  test('browser_responsive_navigation_and_reduced_motion', async ({ page }) => {
    // 1. Mobile responsive test
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');

    const mobileToggle = page.getByRole('button', { name: 'Toggle navigation' });
    await expect(mobileToggle).toBeVisible();

    // Toggle mobile sidebar
    await mobileToggle.click();
    await expect(mobileToggle).toHaveAttribute('aria-expanded', 'true');

    // 2. Reduced motion media query test
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await expect(page.locator('[data-reduced-motion="true"]')).toBeVisible();
  });

  test('browser_runtime_offline_visible_in_ui', async ({ page }) => {
    runtime = await startE2ERuntime();
    await page.goto('/');

    // Stop runtime to simulate offline status
    await runtime.stop();

    // Submit a registration attempt while runtime is offline
    const projInput = page.getByLabel('Project root path');
    await projInput.fill('/some/unreachable/project');
    const [response] = await Promise.all([
      page.waitForResponse(response => response.url().includes('/commands/registerProject')),
      page.getByRole('button', { name: 'Register Project' }).click(),
    ]);
    expect(response.status()).toBe(503);
    const alert = page.getByRole('main').getByRole('alert');
    await expect(alert).toBeVisible();
    await expect(alert).toHaveText(/.+/);
  });

  test('arbitrary_proxy_url_denied', async () => {
    const createMockRequest = (url: string): ProxyRequestLike => ({
      method: 'GET',
      nextUrl: { searchParams: new URL(url).searchParams },
      headers: { get: () => null }
    });

    const res1 = await proxyToRuntime(createMockRequest('http://127.0.0.1:3000/api/v1/https://evil.com/leak'), ['https://evil.com', 'leak']);
    expect(res1.status).toBe(403);

    const res2 = await proxyToRuntime(createMockRequest('http://127.0.0.1:3000/api/v1/../../../etc/passwd'), ['..', '..', '..', 'etc', 'passwd']);
    expect(res2.status).toBe(403);
  });

  test('frozen_lockfile_ci', async () => {
    const lockfilePath = path.resolve(process.cwd(), 'pnpm-lock.yaml');
    expect(fs.existsSync(lockfilePath)).toBe(true);
    const content = fs.readFileSync(lockfilePath, 'utf-8');
    expect(content).toContain('lockfileVersion:');
    expect(content).toContain('next@16.4.0');
  });
});
