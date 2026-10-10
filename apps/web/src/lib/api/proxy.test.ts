import { describe, it, expect, vi } from 'vitest';
import { proxyToRuntime, ProxyRequestLike } from './proxy';

function createMockRequest(params: {
  url: string;
  method?: string;
  origin?: string | null;
  sessionId?: string | null;
  body?: string;
}): ProxyRequestLike {
  const parsed = new URL(params.url);
  return {
    method: params.method || 'GET',
    nextUrl: { searchParams: parsed.searchParams },
    headers: {
      get: (headerName: string) => {
        const lower = headerName.toLowerCase();
        if (lower === 'origin') return params.origin ?? null;
        if (lower === 'x-session-id') return params.sessionId ?? null;
        if (lower === 'content-type') return 'application/json';
        return null;
      }
    },
    text: async () => params.body || ''
  };
}

describe('proxyToRuntime security', () => {
  it('rejects_arbitrary_proxy_target', async () => {
    const req1 = createMockRequest({ url: 'http://127.0.0.1:3000/api/v1/https://evil.com/leak' });
    const res1 = await proxyToRuntime(req1, ['https://evil.com', 'leak']);
    expect(res1.status).toBe(403);
    const body1 = await res1.json();
    expect(body1.error.code).toBe('FORBIDDEN_PROXY_TARGET');

    const req2 = createMockRequest({ url: 'http://127.0.0.1:3000/api/v1/../../../etc/passwd' });
    const res2 = await proxyToRuntime(req2, ['..', '..', '..', 'etc', 'passwd']);
    expect(res2.status).toBe(403);
    const body2 = await res2.json();
    expect(body2.error.code).toBe('FORBIDDEN_PROXY_TARGET');
  });

  it('rejects_foreign_browser_origin', async () => {
    const req = createMockRequest({
      url: 'http://127.0.0.1:3000/api/v1/commands/registerProject',
      method: 'POST',
      origin: 'https://evil.attacker.com'
    });
    const res = await proxyToRuntime(req, ['commands', 'registerProject']);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error.code).toBe('FORBIDDEN_ORIGIN');
  });

  it('rejects_null_browser_origin', async () => {
    const req = createMockRequest({
      url: 'http://127.0.0.1:3000/api/v1/commands/registerProject',
      method: 'POST',
      origin: 'null'
    });
    const res = await proxyToRuntime(req, ['commands', 'registerProject']);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error.code).toBe('FORBIDDEN_ORIGIN');
  });

  it('forwards_valid_origin_and_session_without_laundering', async () => {
    const originalFetch = globalThis.fetch;
    const fetchSpy = vi.fn().mockResolvedValue({
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      text: async () => JSON.stringify({ ok: true, value: { id: 'p-1' } })
    });
    globalThis.fetch = fetchSpy;

    try {
      const req = createMockRequest({
        url: 'http://127.0.0.1:3000/api/v1/commands/registerProject',
        method: 'POST',
        origin: 'http://127.0.0.1:3000',
        sessionId: 'valid-session-123',
        body: JSON.stringify({ root: '/test' })
      });
      const res = await proxyToRuntime(req, ['commands', 'registerProject']);
      expect(res.status).toBe(200);

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const callArgs = fetchSpy.mock.calls[0];
      const headers = callArgs[1].headers;
      expect(headers['origin']).toBe('http://127.0.0.1:3000');
      expect(headers['x-session-id']).toBe('valid-session-123');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

it('browser_mutation_without_origin_is_denied_before_forwarding', async () => {
  const request = createMockRequest({ url: 'http://127.0.0.1:3000/api/v1/commands/registerProject', method: 'POST' });
  const response = await proxyToRuntime(request, ['commands', 'registerProject']);
  expect(response.status).toBe(403);
  expect((await response.json()).error.code).toBe('FORBIDDEN_ORIGIN');
});

it('browser_bootstrap_keeps_credential_in_http_only_cookie', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ ok: true, value: { sessionId: 'private-session-fixture' } }), { status: 200, headers: { 'content-type': 'application/json' } });
  try {
    const response = await proxyToRuntime(createMockRequest({ url: 'http://127.0.0.1:3000/api/v1/session/bootstrap', method: 'POST', origin: 'http://127.0.0.1:3000', body: JSON.stringify({ bootstrapCode: 'fixture' }) }), ['session', 'bootstrap']);
    expect(await response.json()).toEqual({ ok: true, value: { connected: true } });
    expect(response.headers.get('set-cookie')).toContain('HttpOnly');
    expect(response.headers.get('set-cookie')).toContain('SameSite=strict');
  } finally { globalThis.fetch = original; }
});
