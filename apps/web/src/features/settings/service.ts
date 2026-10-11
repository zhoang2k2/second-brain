import { Project, Vault, RegistrationInput, Result } from '@zhon/contracts';

export interface ApiClient {
  bootstrap?(code: string): Promise<Result<{ connected: true }>>;
  health?(): Promise<{ ready: boolean; checks: Array<{ name: string; status: 'PASS' | 'FAIL' | 'BLOCKED'; message?: string }> }>;
  registerProject(input: RegistrationInput): Promise<Result<Project>>;
  registerVault(input: RegistrationInput): Promise<Result<Vault>>;
  getProjects?(): Promise<Result<Project[]> | Project[]>;
  getVaults?(): Promise<Result<Vault[]> | Vault[]>;
}

export class SettingsService {
  constructor(private client?: ApiClient) {}

  async connect(code: string): Promise<Result<{ connected: true }>> {
    if (!this.client?.bootstrap) {
      return { ok: false, error: { code: 'API_CLIENT_UNAVAILABLE', message: 'Runtime connection is unavailable', retryable: false } };
    }
    return this.client.bootstrap(code);
  }

  async registerProject(root: string, remote?: string): Promise<Result<Project>> {
    if (!this.client) {
      return {
        ok: false,
        error: {
          code: 'API_CLIENT_UNAVAILABLE',
          message: 'API client is not configured',
          retryable: false,
        },
      };
    }
    return this.client.registerProject({ root, remote });
  }

  async registerVault(root: string): Promise<Result<Vault>> {
    if (!this.client) {
      return {
        ok: false,
        error: {
          code: 'API_CLIENT_UNAVAILABLE',
          message: 'API client is not configured',
          retryable: false,
        },
      };
    }
    return this.client.registerVault({ root });
  }

  async getProjects(): Promise<Result<Project[]>> {
    if (!this.client) {
      return {
        ok: false,
        error: {
          code: 'API_CLIENT_UNAVAILABLE',
          message: 'API client is not configured',
          retryable: false,
        },
      };
    }
    if (!this.client.getProjects) {
      return { ok: true, value: [] };
    }
    const res = await this.client.getProjects();
    if (Array.isArray(res)) {
      return { ok: true, value: res };
    }
    return res;
  }

  async getVaults(): Promise<Result<Vault[]>> {
    if (!this.client) {
      return {
        ok: false,
        error: {
          code: 'API_CLIENT_UNAVAILABLE',
          message: 'API client is not configured',
          retryable: false,
        },
      };
    }
    if (!this.client.getVaults) {
      return { ok: true, value: [] };
    }
    const res = await this.client.getVaults();
    if (Array.isArray(res)) {
      return { ok: true, value: res };
    }
    return res;
  }
}
