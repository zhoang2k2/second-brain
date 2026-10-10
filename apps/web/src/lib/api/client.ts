import { Command, Result, RuntimeEvent, Project, Vault, RegistrationInput } from '@zhon/contracts';

export interface ApiClientConfig {
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  sessionId?: string;
}

export interface ApiClient {
  command<T, U>(name: string, command: Command<T>): Promise<Result<U>>;
  query<T>(path: string): Promise<Result<T>>;
  subscribe(after: number, onEvent: (event: RuntimeEvent<unknown>) => void): () => void;
  registerProject(input: RegistrationInput): Promise<Result<Project>>;
  registerVault(input: RegistrationInput): Promise<Result<Vault>>;
  getProjects(): Promise<Result<Project[]>>;
  getVaults(): Promise<Result<Vault[]>>;
  bootstrap?(bootstrapCode: string): Promise<Result<{ connected: true }>>;
  setSessionId?(sessionId: string): void;
  getSessionId?(): string | undefined;
}

export function createApiClient(config: ApiClientConfig = {}): ApiClient {
  const baseUrl = config.baseUrl || '/api/v1';
  const fetchFn = config.fetchImpl || fetch;
  let currentSessionId: string | undefined = config.sessionId;

  function setSessionId(sessionId: string): void {
    currentSessionId = sessionId;
  }

  function getSessionId(): string | undefined {
    return currentSessionId;
  }

  async function bootstrap(bootstrapCode: string): Promise<Result<{ connected: true }>> {
    try {
      const res = await fetchFn(`${baseUrl}/session/bootstrap`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ bootstrapCode })
      });
      const data = await res.json();
      return data;
    } catch (err: unknown) {
      return {
        ok: false,
        error: {
          code: 'NETWORK_ERROR',
          message: err instanceof Error ? err.message : 'Bootstrap network error',
          retryable: true
        }
      };
    }
  }

  async function command<T, U>(name: string, cmd: Command<T>): Promise<Result<U>> {
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };
      if (currentSessionId) {
        headers['x-session-id'] = currentSessionId;
      }

      const res = await fetchFn(`${baseUrl}/commands/${name}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(cmd)
      });

      if (!res.ok) {
        try {
          const errBody = await res.json();
          if (errBody && errBody.ok === false) {
            return errBody;
          }
        } catch {
          // fallback
        }
        return {
          ok: false,
          error: {
            code: `HTTP_${res.status}`,
            message: `HTTP error ${res.status}: ${res.statusText}`,
            retryable: res.status >= 500
          }
        };
      }

      return await res.json();
    } catch (err: unknown) {
      return {
        ok: false,
        error: {
          code: 'NETWORK_ERROR',
          message: err instanceof Error ? err.message : 'Network request failed',
          retryable: true
        }
      };
    }
  }

  async function query<T>(path: string): Promise<Result<T>> {
    try {
      const headers: Record<string, string> = {};
      if (currentSessionId) {
        headers['x-session-id'] = currentSessionId;
      }

      const cleanPath = path.startsWith('/') ? path.slice(1) : path;
      const res = await fetchFn(`${baseUrl}/${cleanPath}`, {
        method: 'GET',
        headers
      });

      if (!res.ok) {
        return {
          ok: false,
          error: {
            code: `HTTP_${res.status}`,
            message: `HTTP error ${res.status}: ${res.statusText}`,
            retryable: res.status >= 500
          }
        };
      }

      return await res.json();
    } catch (err: unknown) {
      return {
        ok: false,
        error: {
          code: 'NETWORK_ERROR',
          message: err instanceof Error ? err.message : 'Network request failed',
          retryable: true
        }
      };
    }
  }

  function subscribe(after: number, onEvent: (event: RuntimeEvent<unknown>) => void): () => void {
    if (typeof window === 'undefined') {
      return () => {};
    }

    const url = `${baseUrl}/events?after=${after}`;
    const eventSource = new EventSource(url);

    eventSource.onmessage = (e) => {
      try {
        const parsed = JSON.parse(e.data);
        onEvent(parsed);
      } catch {
        // ignore malformed events
      }
    };

    return () => {
      eventSource.close();
    };
  }

  const client: ApiClient = {
    command,
    query,
    subscribe,
    bootstrap,
    setSessionId,
    getSessionId,

    async registerProject(input: RegistrationInput): Promise<Result<Project>> {
      return command<RegistrationInput, Project>('registerProject', {
        requestId: `req-${Date.now()}`,
        idempotencyKey: `idem-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        payload: input
      });
    },

    async registerVault(input: RegistrationInput): Promise<Result<Vault>> {
      return command<RegistrationInput, Vault>('registerVault', {
        requestId: `req-${Date.now()}`,
        idempotencyKey: `idem-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        payload: input
      });
    },

    async getProjects(): Promise<Result<Project[]>> {
      return query<Project[]>('projects');
    },

    async getVaults(): Promise<Result<Vault[]>> {
      return query<Vault[]>('vaults');
    }
  };


  return client;
}
