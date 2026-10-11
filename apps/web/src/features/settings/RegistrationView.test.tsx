import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { RegistrationView } from './RegistrationView';
import { ApiClient } from './service';

describe('RegistrationView Component', () => {
  it('failed_registration_is_visible', async () => {
    const user = userEvent.setup();
    const mockApi: ApiClient = {
      registerProject: vi.fn().mockResolvedValue({
        ok: false,
        error: {
          code: 'PATH_TRAVERSAL_DETECTED',
          message: 'Root path cannot contain traversal components',
          retryable: false,
        },
      }),
      registerVault: vi.fn().mockResolvedValue({
        ok: false,
        error: {
          code: 'INVALID_PATH',
          message: 'Vault path does not exist',
          retryable: false,
        },
      }),
    };

    render(<RegistrationView api={mockApi} />);

    // Attempt to register an invalid project
    const projectInput = screen.getByLabelText(/project root path/i);
    const registerProjectBtn = screen.getByRole('button', { name: /register project/i });

    await user.type(projectInput, '../escaped/path');
    await user.click(registerProjectBtn);

    // Verify error is visible
    await waitFor(() => {
      const errorMsg = screen.getByText('Root path cannot contain traversal components');
      expect(errorMsg).toBeVisible();
    });

    // Attempt to register an invalid vault
    const vaultInput = screen.getByLabelText(/vault root path/i);
    const registerVaultBtn = screen.getByRole('button', { name: /register vault/i });

    await user.type(vaultInput, '/nonexistent/vault');
    await user.click(registerVaultBtn);

    // Verify vault error is visible
    await waitFor(() => {
      const vaultErrorMsg = screen.getByText('Vault path does not exist');
      expect(vaultErrorMsg).toBeVisible();
    });
  });

  it('successful registration adds item to list', async () => {
    const user = userEvent.setup();
    const mockApi: ApiClient = {
      registerProject: vi.fn().mockResolvedValue({
        ok: true,
        value: {
          id: 'proj-1',
          root: '/Users/test/project-alpha',
          version: 1,
          createdAt: new Date().toISOString(),
        },
      }),
      registerVault: vi.fn().mockResolvedValue({
        ok: true,
        value: {
          id: 'vault-1',
          root: '/Users/test/vault-notes',
          version: 1,
          createdAt: new Date().toISOString(),
        },
      }),
    };

    render(<RegistrationView api={mockApi} />);

    const projectInput = screen.getByLabelText(/project root path/i);
    const registerProjectBtn = screen.getByRole('button', { name: /register project/i });

    await user.type(projectInput, '/Users/test/project-alpha');
    await user.click(registerProjectBtn);

    await waitFor(() => {
      expect(screen.getByText('/Users/test/project-alpha')).toBeInTheDocument();
    });

    const vaultInput = screen.getByLabelText(/vault root path/i);
    const registerVaultBtn = screen.getByRole('button', { name: /register vault/i });

    await user.type(vaultInput, '/Users/test/vault-notes');
    await user.click(registerVaultBtn);

    await waitFor(() => {
      expect(screen.getByText('/Users/test/vault-notes')).toBeInTheDocument();
    });
  });

  it('initial_load_displays_saved_projects_and_vaults_on_mount', async () => {
    const mockApi: ApiClient = {
      registerProject: vi.fn(),
      registerVault: vi.fn(),
      getProjects: vi.fn().mockResolvedValue({
        ok: true,
        value: [
          {
            id: 'proj-persisted',
            root: '/Users/test/existing-project',
            version: 1,
            createdAt: '2026-10-10T10:00:00Z',
          },
        ],
      }),
      getVaults: vi.fn().mockResolvedValue({
        ok: true,
        value: [
          {
            id: 'vault-persisted',
            root: '/Users/test/existing-vault',
            version: 1,
            createdAt: '2026-10-10T10:00:00Z',
          },
        ],
      }),
    };

    render(<RegistrationView api={mockApi} />);

    await waitFor(() => {
      expect(screen.getByText('/Users/test/existing-project')).toBeInTheDocument();
      expect(screen.getByText('/Users/test/existing-vault')).toBeInTheDocument();
    });
  });
});

it('initial_query_failure_is_visible', async () => {
  const api: ApiClient = {
    registerProject: vi.fn(), registerVault: vi.fn(),
    getProjects: async () => ({ ok: false, error: { code: 'OFFLINE', message: 'Runtime offline', retryable: true } }),
    getVaults: async () => ({ ok: true, value: [] }),
  };
  render(<RegistrationView api={api} />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Runtime offline');
});
