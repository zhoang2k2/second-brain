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
    const EventSourceConstructor =
      typeof EventSource !== 'undefined'
        ? EventSource
        : typeof window !== 'undefined' && window.EventSource
          ? window.EventSource
          : undefined;

    if (!EventSourceConstructor) {
      return () => {};
    }

    const cleanBaseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    const url = `${cleanBaseUrl}/events?after=${after}`;
    const eventSource = new EventSourceConstructor(url);

    const handleEvent = (e: MessageEvent) => {
      try {
        if (!e || typeof e.data !== 'string' || e.data.trim() === '') {
          return;
        }
        const parsed = JSON.parse(e.data);
        if (parsed && typeof parsed === 'object') {
          onEvent(parsed as RuntimeEvent<unknown>);
        }
      } catch {
        // safely ignore malformed JSON events without crashing or throwing
      }
    };

    const handleNamed = (e: Event) => handleEvent(e as MessageEvent);
    const namedEvents = [
      'project.registered', 'vault.registered', 'knowledge.candidate_created',
      'knowledge.note_updated', 'knowledge.candidate_approved',
      'knowledge.candidate_rejected', 'knowledge.note_deactivated', 'knowledge.scan_completed',
    ];

    if (typeof eventSource.addEventListener === 'function') {
      for (const name of namedEvents) eventSource.addEventListener(name, handleNamed);
    }
    eventSource.onmessage = handleEvent;

    return () => {
      try {
        if (typeof eventSource.removeEventListener === 'function') {
          for (const name of namedEvents) eventSource.removeEventListener(name, handleNamed);
        }
        eventSource.onmessage = null;
        if (typeof eventSource.close === 'function') {
          eventSource.close();
        }
      } catch {
        // Safe cleanup
      }
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
