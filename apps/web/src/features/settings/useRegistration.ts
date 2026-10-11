'use client';

import { useState, useCallback, useEffect } from 'react';
import { Project, Vault, Result } from '@zhon/contracts';
import { ApiClient, SettingsService } from './service';

export function useRegistration(api?: ApiClient) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [vaults, setVaults] = useState<Vault[]>([]);
  const [pending, setPending] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(() => Boolean(api));
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!api) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const service = new SettingsService(api);
      const [projRes, vaultRes] = await Promise.all([
        service.getProjects(),
        service.getVaults(),
      ]);

      if (projRes.ok === false) setError(projRes.error.message);
      if (vaultRes.ok === false) setError(vaultRes.error.message);
      if (projRes.ok && 'value' in projRes) {
        setProjects(projRes.value);
      }
      if (vaultRes.ok && 'value' in vaultRes) {
        setVaults(vaultRes.value);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load registrations';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    let mounted = true;
    if (!api) {
      return;
    }
    const service = new SettingsService(api);
    Promise.all([service.getProjects(), service.getVaults()])
      .then(([projRes, vaultRes]) => {
        if (!mounted) return;
        if (projRes.ok === false) setError(projRes.error.message);
        if (vaultRes.ok === false) setError(vaultRes.error.message);
        if (projRes.ok && 'value' in projRes) {
          setProjects(projRes.value);
        }
        if (vaultRes.ok && 'value' in vaultRes) {
          setVaults(vaultRes.value);
        }
      })
      .catch((err: unknown) => {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : 'Failed to load registrations');
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [api]);

  const registerProject = useCallback(
    async (root: string, remote?: string): Promise<Result<Project>> => {
      setPending(true);
      setError(null);
      try {
        const service = new SettingsService(api);
        const res = await service.registerProject(root, remote);
        if (res.ok && 'value' in res) {
          setProjects((prev) => [...prev.filter((p) => p.id !== res.value.id), res.value]);
        } else if ('error' in res) {
          setError(res.error.message);
        }
        return res;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Unknown registration error';
        setError(msg);
        return {
          ok: false,
          error: {
            code: 'UNEXPECTED_ERROR',
            message: msg,
            retryable: false,
          },
        };
      } finally {
        setPending(false);
      }
    },
    [api]
  );

  const registerVault = useCallback(
    async (root: string): Promise<Result<Vault>> => {
      setPending(true);
      setError(null);
      try {
        const service = new SettingsService(api);
        const res = await service.registerVault(root);
        if (res.ok && 'value' in res) {
          setVaults((prev) => [...prev.filter((v) => v.id !== res.value.id), res.value]);
        } else if ('error' in res) {
          setError(res.error.message);
        }
        return res;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Unknown registration error';
        setError(msg);
        return {
          ok: false,
          error: {
            code: 'UNEXPECTED_ERROR',
            message: msg,
            retryable: false,
          },
        };
      } finally {
        setPending(false);
      }
    },
    [api]
  );

  return {
    projects,
    vaults,
    pending,
    loading,
    error,
    registerProject,
    registerVault,
    reload,
  };
}
