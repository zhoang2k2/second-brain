import { NextResponse } from 'next/server';

const RUNTIME_BASE_URL = process.env.ZHON_RUNTIME_URL || 'http://127.0.0.1:4100';

export interface ProxyRequestLike {
  method: string;
  nextUrl?: { searchParams: URLSearchParams };
  headers: { get(name: string): string | null };
  signal?: AbortSignal;
  text?(): Promise<string>;
}

export async function proxyToRuntime(request: ProxyRequestLike, pathSegments: string[]) {
  const targetPath = pathSegments.join('/');

  // Security gate: arbitrary_proxy_url_denied
  // The path must not contain protocol schemes, domain names, or path traversal escapes
  if (
    targetPath.includes('://') ||
    targetPath.startsWith('//') ||
    targetPath.includes('..') ||
    targetPath.includes('@')
  ) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: 'FORBIDDEN_PROXY_TARGET',
          message: 'Arbitrary proxy target URLs are denied',
          retryable: false
        }
      },
      { status: 403 }
    );
  }

  // Origin validation: browser requests must provide a permitted local web origin
  const incomingOrigin = request.headers.get('origin');
  if (!incomingOrigin && request.method !== 'GET' && request.method !== 'HEAD') {
    return NextResponse.json({ ok: false, error: { code: 'FORBIDDEN_ORIGIN', message: 'Browser mutation requires an allowed Origin', retryable: false } }, { status: 403 });
  }
  if (incomingOrigin) {
    const ALLOWED_WEB_ORIGINS = new Set([
      'http://localhost:3000',
      'http://127.0.0.1:3000'
    ]);
    if (incomingOrigin === 'null' || !ALLOWED_WEB_ORIGINS.has(incomingOrigin)) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: 'FORBIDDEN_ORIGIN',
            message: `Forbidden origin: ${incomingOrigin}`,
            retryable: false
          }
        },
        { status: 403 }
      );
    }
  }

  // Construct target loopback URL strictly targeting the runtime
  const normalizedTarget = targetPath.startsWith('v1/') ? targetPath.slice(3) : targetPath;
  const runtimeUrl = new URL(`/v1/${normalizedTarget}`, RUNTIME_BASE_URL);
  if (request.nextUrl?.searchParams) {
    request.nextUrl.searchParams.forEach((val, key) => {
      runtimeUrl.searchParams.set(key, val);
    });
  }

  try {
    const runtimeUrlObj = new URL(RUNTIME_BASE_URL);
    const headers: Record<string, string> = {
      'host': `${runtimeUrlObj.hostname}:${runtimeUrlObj.port || (runtimeUrlObj.protocol === 'https:' ? '443' : '80')}`
    };
    if (incomingOrigin) {
      headers['origin'] = incomingOrigin;
    }

    const clientSession = request.headers.get('x-session-id') || request.headers.get('authorization');
    if (clientSession) {
      if (clientSession.startsWith('Bearer ')) {
        headers['authorization'] = clientSession;
      } else {
        headers['x-session-id'] = clientSession;
      }
    }

    const cookieHeader = request.headers.get('cookie');
    if (!headers['x-session-id'] && !headers['authorization'] && cookieHeader) {
      const match = cookieHeader.match(/zhon_session=([^;]+)/);
      if (match) {
        headers['x-session-id'] = match[1];
      }
    }

    const contentType = request.headers.get('content-type');
    if (contentType) {
      headers['content-type'] = contentType;
    }

    const body = request.method !== 'GET' && request.method !== 'HEAD' && typeof request.text === 'function'
      ? await request.text()
      : undefined;
    const lastEventId = request.headers.get('last-event-id');
    if (lastEventId) headers['last-event-id'] = lastEventId;

    const runtimeRes = await fetch(runtimeUrl.toString(), {
      method: request.method,
      headers,
      body,
      signal: request.signal
    });

    if (targetPath === 'events' && runtimeRes.headers.get('content-type')?.includes('text/event-stream')) {
      const reader = runtimeRes.body?.getReader();
      const stream = new ReadableStream<Uint8Array>({
        async pull(controller) {
          try {
            const chunk = await reader?.read();
            if (!chunk || chunk.done) controller.close();
            else controller.enqueue(chunk.value);
          } catch {
            // A stopped local runtime closes the stream; EventSource reconnects.
            controller.close();
          }
        },
        async cancel() { try { await reader?.cancel(); } catch {} },
      });
      return new NextResponse(stream, { status: runtimeRes.status, headers: {
        'content-type': 'text/event-stream', 'cache-control': 'no-cache, no-transform',
      } });
    }

    const data = await runtimeRes.text();
    let response = new NextResponse(data, {
      status: runtimeRes.status,
      headers: {
        'content-type': runtimeRes.headers.get('content-type') || 'application/json'
      }
    });
    if (targetPath === 'session/bootstrap' && runtimeRes.status === 200) {
      const result = JSON.parse(data);
      if (result.ok && typeof result.value?.sessionId === 'string') {
        response = NextResponse.json({ ok: true, value: { connected: true } });
        response.cookies.set('zhon_session', result.value.sessionId, {
          httpOnly: true, sameSite: 'strict', path: '/', maxAge: 86400,
        });
      }
    }
    return response;
  } catch (err: unknown) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: 'RUNTIME_UNAVAILABLE',
          message: err instanceof Error ? err.message : 'Runtime daemon unreachable',
          retryable: true
        }
      },
      { status: 503 }
    );
  }
}
