'use client';

import React, { useState } from 'react';
import { ApiClient } from './service';
import { useRegistration } from './useRegistration';
import { RuntimeConnection } from './RuntimeConnection';
import { HugeiconsIcon } from '@hugeicons/react';
import { Folder01Icon, Book02Icon, AlertCircleIcon } from '@hugeicons/core-free-icons';

interface RegistrationViewProps {
  api?: ApiClient;
}

export const RegistrationView: React.FC<RegistrationViewProps> = ({ api }) => {
  const {
    projects,
    vaults,
    pending,
    loading,
    error,
    registerProject,
    registerVault,
  } = useRegistration(api);

  const [projectRoot, setProjectRoot] = useState('');
  const [projectRemote, setProjectRemote] = useState('');
  const [vaultRoot, setVaultRoot] = useState('');

  const handleProjectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectRoot.trim()) return;
    const res = await registerProject(projectRoot.trim(), projectRemote.trim() || undefined);
    if (res.ok) {
      setProjectRoot('');
      setProjectRemote('');
    }
  };

  const handleVaultSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vaultRoot.trim()) return;
    const res = await registerVault(vaultRoot.trim());
    if (res.ok) {
      setVaultRoot('');
    }
  };

  return (
    <div className="space-y-8 max-w-2xl mx-auto py-6">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Scope Registration</h2>
        <p className="text-sm mt-1" style={{ color: 'var(--zhon-text-secondary)' }}>
          Register canonical project roots and Obsidian Markdown vaults within filesystem boundaries.
        </p>
      </div>

      <RuntimeConnection api={api} />

      {loading && (
        <div data-testid="registration-loading" className="text-xs animate-pulse" style={{ color: 'var(--zhon-text-secondary)' }}>
          Loading registered roots...
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div
          role="alert"
          aria-live="polite"
          className="flex items-center gap-3 p-3.5 rounded-xl border text-sm"
          style={{
            backgroundColor: 'rgba(239, 68, 68, 0.08)',
            borderColor: 'rgba(239, 68, 68, 0.25)',
            color: '#EF4444',
          }}
        >
          <HugeiconsIcon
            icon={AlertCircleIcon}
            size={18}
            data-icon-source="hugeicons"
            className="hugeicons shrink-0"
          />
          <span className="font-medium">{error}</span>
        </div>
      )}

      {/* Project Registration Section */}
      <div
        className="p-5 rounded-2xl border"
        style={{
          backgroundColor: 'var(--zhon-surface)',
          borderColor: 'var(--zhon-border)',
        }}
      >
        <div className="flex items-center gap-2 mb-4">
          <HugeiconsIcon
            icon={Folder01Icon}
            size={18}
            data-icon-source="hugeicons"
            className="hugeicons"
            style={{ color: 'var(--zhon-sky)' }}
          />
          <h3 className="text-sm font-semibold">Register Project Root</h3>
        </div>

        <form onSubmit={handleProjectSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="project-root"
              className="block text-xs font-medium mb-1.5"
              style={{ color: 'var(--zhon-text-secondary)' }}
            >
              Project root path
            </label>
            <input
              id="project-root"
              type="text"
              value={projectRoot}
              onChange={(e) => setProjectRoot(e.target.value)}
              placeholder="/absolute/path/to/project"
              disabled={pending}
              className="w-full px-3.5 py-2 text-sm rounded-lg border focus:outline-none transition-colors"
              style={{
                backgroundColor: 'var(--zhon-bg)',
                borderColor: 'var(--zhon-border)',
                color: 'var(--zhon-text-primary)',
              }}
            />
          </div>

          <div>
            <label
              htmlFor="project-remote"
              className="block text-xs font-medium mb-1.5"
              style={{ color: 'var(--zhon-text-secondary)' }}
            >
              Remote URL (optional)
            </label>
            <input
              id="project-remote"
              type="text"
              value={projectRemote}
              onChange={(e) => setProjectRemote(e.target.value)}
              placeholder="git@github.com:org/repo.git"
              disabled={pending}
              className="w-full px-3.5 py-2 text-sm rounded-lg border focus:outline-none transition-colors"
              style={{
                backgroundColor: 'var(--zhon-bg)',
                borderColor: 'var(--zhon-border)',
                color: 'var(--zhon-text-primary)',
              }}
            />
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={pending || !projectRoot.trim()}
              className="px-4 py-2 text-xs font-semibold rounded-full transition-opacity cursor-pointer disabled:opacity-50"
              style={{
                backgroundColor: 'var(--zhon-sky)',
                color: '#FFFFFF',
              }}
            >
              Register Project
            </button>
          </div>
        </form>

        {/* Registered Projects List */}
        {projects.length > 0 && (
          <div className="mt-5 pt-4 border-t" style={{ borderColor: 'var(--zhon-border)' }}>
            <h4 className="text-xs font-semibold mb-2" style={{ color: 'var(--zhon-text-secondary)' }}>
              Registered Projects
            </h4>
            <ul className="space-y-1.5">
              {projects.map((proj) => (
                <li
                  key={proj.id}
                  className="px-3 py-1.5 rounded-lg text-xs font-mono"
                  style={{ backgroundColor: 'var(--zhon-bg)' }}
                >
                  {proj.root}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Vault Registration Section */}
      <div
        className="p-5 rounded-2xl border"
        style={{
          backgroundColor: 'var(--zhon-surface)',
          borderColor: 'var(--zhon-border)',
        }}
      >
        <div className="flex items-center gap-2 mb-4">
          <HugeiconsIcon
            icon={Book02Icon}
            size={18}
            data-icon-source="hugeicons"
            className="hugeicons"
            style={{ color: 'var(--zhon-lime)' }}
          />
          <h3 className="text-sm font-semibold">Register Vault Root</h3>
        </div>

        <form onSubmit={handleVaultSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="vault-root"
              className="block text-xs font-medium mb-1.5"
              style={{ color: 'var(--zhon-text-secondary)' }}
            >
              Vault root path
            </label>
            <input
              id="vault-root"
              type="text"
              value={vaultRoot}
              onChange={(e) => setVaultRoot(e.target.value)}
              placeholder="/absolute/path/to/obsidian/vault"
              disabled={pending}
              className="w-full px-3.5 py-2 text-sm rounded-lg border focus:outline-none transition-colors"
              style={{
                backgroundColor: 'var(--zhon-bg)',
                borderColor: 'var(--zhon-border)',
                color: 'var(--zhon-text-primary)',
              }}
            />
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={pending || !vaultRoot.trim()}
              className="px-4 py-2 text-xs font-semibold rounded-full transition-opacity cursor-pointer disabled:opacity-50"
              style={{
                backgroundColor: 'var(--zhon-lime)',
                color: '#FFFFFF',
              }}
            >
              Register Vault
            </button>
          </div>
        </form>

        {/* Registered Vaults List */}
        {vaults.length > 0 && (
          <div className="mt-5 pt-4 border-t" style={{ borderColor: 'var(--zhon-border)' }}>
            <h4 className="text-xs font-semibold mb-2" style={{ color: 'var(--zhon-text-secondary)' }}>
              Registered Vaults
            </h4>
            <ul className="space-y-1.5">
              {vaults.map((v) => (
                <li
                  key={v.id}
                  className="px-3 py-1.5 rounded-lg text-xs font-mono"
                  style={{ backgroundColor: 'var(--zhon-bg)' }}
                >
                  {v.root}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};
