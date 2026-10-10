import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { FastifyInstance } from 'fastify';
import { createServer } from '../../apps/runtime/src/server/create-server';
import { openStore, Store } from '../../apps/runtime/src/storage/database';
import { RegisteredRootPolicy } from '../../apps/runtime/src/adapters/filesystem/registered-paths';
import { LocalSessionManager } from '../../apps/runtime/src/server/local-session';
import { EventStore } from '../../apps/runtime/src/server/events';
import { createApiClient } from '../../apps/web/src/lib/api/client';
import { RuntimeEvent, Project } from '@zhon/contracts';

interface ParsedSSE {
  id?: string;
  event?: string;
  data: string;
}

function parseSSEChunk(raw: string): ParsedSSE[] {
  const events: ParsedSSE[] = [];
  const blocks = raw.split('\n\n');
  for (const block of blocks) {
    if (!block.trim()) continue;
    let id: string | undefined;
    let event: string | undefined;
    const dataLines: string[] = [];
    const lines = block.split('\n');
    for (const line of lines) {
      if (line.startsWith('id: ')) {
        id = line.slice(4).trim();
      } else if (line.startsWith('event: ')) {
        event = line.slice(7).trim();
      } else if (line.startsWith('data: ')) {
        dataLines.push(line.slice(6));
      }
    }
    if (dataLines.length > 0) {
      events.push({ id, event, data: dataLines.join('\n') });
    }
  }
  return events;
}

interface MockEvent {
  data: string;
}

type MockEventListener = (e: MockEvent) => void;

class MockEventSource {
  public url: string;
  public listeners: Record<string, MockEventListener[]> = {};
  public onmessage: MockEventListener | null = null;
  public closed = false;

  constructor(url: string) {
    this.url = url;
  }

  addEventListener(type: string, listener: MockEventListener) {
    if (!this.listeners[type]) this.listeners[type] = [];
    this.listeners[type].push(listener);
  }

  removeEventListener(type: string, listener: MockEventListener) {
    if (this.listeners[type]) {
      this.listeners[type] = this.listeners[type].filter(l => l !== listener);
    }
  }

  close() {
    this.closed = true;
  }

  emit(type: string, data: string) {
    const event: MockEvent = { data };
    if (this.listeners[type]) {
      for (const l of this.listeners[type]) {
        l(event);
      }
    }
    if (type === 'message' && typeof this.onmessage === 'function') {
      this.onmessage(event);
    }
  }
}

interface EventStoreInternal {
  listeners: Set<unknown>;
}

describe('SSE Protocol and Client-Server Transport Integration', () => {
  let server: FastifyInstance;
  let store: Store;
  let eventStore: EventStore;
  let tempDir: string;
  let allowedRoot: string;
  let runtimeUrl: string;
  let sessionId: string;

  beforeAll(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zhon-sse-integration-'));
    const dbPath = path.join(tempDir, 'sse.db');
    allowedRoot = path.join(tempDir, 'allowed');
    fs.mkdirSync(allowedRoot, { recursive: true });

    store = openStore(dbPath);
    const policy = new RegisteredRootPolicy([allowedRoot]);
    const sessionManager = new LocalSessionManager({
      allowedOrigins: ['http://localhost:3000', 'http://127.0.0.1:3000'],
      requireSession: true
    });
    eventStore = new EventStore();

    server = await createServer({
      store,
      clock: () => '2026-10-10T12:00:00Z',
      registeredRootPolicy: policy,
      localSessionConfig: {
        allowedOrigins: ['http://localhost:3000', 'http://127.0.0.1:3000'],
        requireSession: true
      },
      sessionManager,
      eventStore
    });

    await server.listen({ host: '127.0.0.1', port: 0 });
    const addr = server.server.address();
    const port = typeof addr === 'object' && addr ? addr.port : 4198;
    runtimeUrl = `http://127.0.0.1:${port}`;

    // Generate authenticated session for browser commands
    const bootstrapCode = sessionManager.generateBootstrapCode('browser');
    const bootRes = sessionManager.createLocalSession({
      bootstrapCode,
      origin: 'http://localhost:3000'
    });
    if (!bootRes.ok) throw new Error('Bootstrap failed');
    sessionId = bootRes.value.sessionId;
  });

  afterAll(async () => {
    try {
      if (typeof server.server.closeAllConnections === 'function') {
        server.server.closeAllConnections();
      }
      await server.close();
    } catch {}
    try {
      store.close();
    } catch {}
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('delivers live named events with exact sequence, type, and payload over SSE stream', async () => {
    const controller = new AbortController();
    const res = await fetch(`${runtimeUrl}/v1/events`, {
      signal: controller.signal,
      headers: {
        Accept: 'text/event-stream'
      }
    });

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/event-stream');

    const reader = res.body?.getReader();
    expect(reader).toBeDefined();

    // Register a new project to trigger an event
    const projDir = path.join(allowedRoot, 'p-sse-1');
    fs.mkdirSync(projDir, { recursive: true });

    const postPromise = fetch(`${runtimeUrl}/v1/commands/registerProject`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-session-id': sessionId,
        origin: 'http://localhost:3000'
      },
      body: JSON.stringify({
        requestId: 'req-sse-1',
        idempotencyKey: 'idem-sse-1',
        payload: { root: projDir }
      })
    });

    // Read the SSE stream chunk
    const decoder = new TextDecoder();
    let accumulated = '';
    const readChunk = async (): Promise<ParsedSSE[]> => {
      while (true) {
        const chunkResult = await reader!.read();
        if (chunkResult.done) break;
        accumulated += decoder.decode(chunkResult.value, { stream: true });
        const parsed = parseSSEChunk(accumulated);
        if (parsed.length > 0) {
          return parsed;
        }
      }
      return [];
    };

    try {
      const [postRes, events] = await Promise.all([postPromise, readChunk()]);
      expect(postRes.status).toBe(200);
      const postData = await postRes.json();
      expect(postData.ok).toBe(true);

      expect(events.length).toBeGreaterThanOrEqual(1);
      const event = events[0];
      expect(event.event).toBe('project.registered');
      expect(event.id).toBe('1');

      const payload = JSON.parse(event.data);
      expect(payload.type).toBe('project.registered');
      expect(payload.sequence).toBe(1);
      expect(payload.resourceId).toBe(postData.value.id);
      expect(payload.payload.root).toBe(fs.realpathSync(projDir));
    } finally {
      controller.abort();
    }
  });

  it('reconnects and queries historical events with after sequence and Last-Event-ID', async () => {
    // Register a second project so sequence = 2
    const projDir2 = path.join(allowedRoot, 'p-sse-2');
    fs.mkdirSync(projDir2, { recursive: true });

    const postRes = await fetch(`${runtimeUrl}/v1/commands/registerProject`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-session-id': sessionId,
        origin: 'http://localhost:3000'
      },
      body: JSON.stringify({
        requestId: 'req-sse-2',
        idempotencyKey: 'idem-sse-2',
        payload: { root: projDir2 }
      })
    });
    expect(postRes.status).toBe(200);

    // 1. Query with ?after=1 should receive ONLY event sequence 2
    const controller1 = new AbortController();
    try {
      const resAfter1 = await fetch(`${runtimeUrl}/v1/events?after=1`, {
        signal: controller1.signal
      });
      const reader1 = resAfter1.body?.getReader();
      const decoder = new TextDecoder();
      const chunk1 = await reader1!.read();
      const text1 = decoder.decode(chunk1.value);
      const eventsAfter1 = parseSSEChunk(text1);

      expect(eventsAfter1.length).toBe(1);
      expect(eventsAfter1[0].id).toBe('2');
      expect(eventsAfter1[0].event).toBe('project.registered');
      const parsed1 = JSON.parse(eventsAfter1[0].data);
      expect(parsed1.sequence).toBe(2);
    } finally {
      controller1.abort();
    }

    // 2. Query with Last-Event-ID: 1 header should also receive ONLY event sequence 2
    const controller2 = new AbortController();
    try {
      const resLastId = await fetch(`${runtimeUrl}/v1/events`, {
        signal: controller2.signal,
        headers: {
          'Last-Event-ID': '1'
        }
      });
      const reader2 = resLastId.body?.getReader();
      const decoder = new TextDecoder();
      const chunk2 = await reader2!.read();
      const text2 = decoder.decode(chunk2.value);
      const eventsLastId = parseSSEChunk(text2);

      expect(eventsLastId.length).toBe(1);
      expect(eventsLastId[0].id).toBe('2');
      expect(JSON.parse(eventsLastId[0].data).sequence).toBe(2);
    } finally {
      controller2.abort();
    }

    // 3. Query with ?after=2: historical returns nothing, then register 3rd project and receive seq 3
    const controller3 = new AbortController();
    try {
      const resAfter2 = await fetch(`${runtimeUrl}/v1/events?after=2`, {
        signal: controller3.signal
      });
      const reader3 = resAfter2.body?.getReader();

      const projDir3 = path.join(allowedRoot, 'p-sse-3');
      fs.mkdirSync(projDir3, { recursive: true });
      const reg3Promise = fetch(`${runtimeUrl}/v1/commands/registerProject`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-session-id': sessionId,
          origin: 'http://localhost:3000'
        },
        body: JSON.stringify({
          requestId: 'req-sse-3',
          idempotencyKey: 'idem-sse-3',
          payload: { root: projDir3 }
        })
      });

      const decoder = new TextDecoder();
      const [reg3Res, chunk] = await Promise.all([
        reg3Promise,
        (async () => {
          const chunk3 = await reader3!.read();
          return decoder.decode(chunk3.value);
        })()
      ]);
      expect(reg3Res.status).toBe(200);

      const eventsAfter2 = parseSSEChunk(chunk);
      expect(eventsAfter2.length).toBe(1);
      expect(eventsAfter2[0].id).toBe('3');
      expect(eventsAfter2[0].event).toBe('project.registered');
    } finally {
      controller3.abort();
    }
  });

  it('ApiClient.subscribe handles named events, message events, and malformed JSON safely', async () => {
    const createdInstances: MockEventSource[] = [];
    class TrackedMockEventSource extends MockEventSource {
      constructor(url: string) {
        super(url);
        createdInstances.push(this);
      }
    }

    const globalObj = globalThis as unknown as { EventSource?: unknown };
    globalObj.EventSource = TrackedMockEventSource;

    const client = createApiClient({ baseUrl: `${runtimeUrl}/v1` });
    const receivedEvents: RuntimeEvent<unknown>[] = [];

    const unsubscribe = client.subscribe(0, (event) => {
      receivedEvents.push(event);
    });

    const activeMock = createdInstances[0];
    expect(activeMock).toBeDefined();
    expect(activeMock.url).toBe(`${runtimeUrl}/v1/events?after=0`);

    // 1. Emit named event: 'project.registered'
    const validProjEvent: RuntimeEvent<Partial<Project>> = {
      sequence: 10,
      type: 'project.registered',
      resourceId: 'proj-123',
      occurredAt: '2026-10-10T12:00:00Z',
      payload: { id: 'proj-123', root: '/test/p' }
    };
    activeMock.emit('project.registered', JSON.stringify(validProjEvent));
    expect(receivedEvents).toHaveLength(1);
    expect(receivedEvents[0].sequence).toBe(10);
    expect(receivedEvents[0].type).toBe('project.registered');

    // 2. Emit named event: 'vault.registered'
    const validVaultEvent: RuntimeEvent<unknown> = {
      sequence: 11,
      type: 'vault.registered',
      resourceId: 'vault-123',
      occurredAt: '2026-10-10T12:00:00Z',
      payload: { id: 'vault-123' }
    };
    activeMock.emit('vault.registered', JSON.stringify(validVaultEvent));
    expect(receivedEvents).toHaveLength(2);
    expect(receivedEvents[1].sequence).toBe(11);

    // 3. Emit general 'message' event
    const validMessageEvent: RuntimeEvent<unknown> = {
      sequence: 12,
      type: 'general.event',
      resourceId: 'res-1',
      occurredAt: '2026-10-10T12:00:00Z',
      payload: { ok: true }
    };
    activeMock.emit('message', JSON.stringify(validMessageEvent));
    expect(receivedEvents).toHaveLength(3);
    expect(receivedEvents[2].sequence).toBe(12);

    // 4. Emit malformed JSON events - MUST NOT throw and must ignore
    expect(() => {
      activeMock.emit('project.registered', '{invalid-json-string');
      activeMock.emit('vault.registered', '<<<malformed>>>');
      activeMock.emit('message', '{"unclosed-json');
      activeMock.emit('message', '');
    }).not.toThrow();

    // No new events should have been added
    expect(receivedEvents).toHaveLength(3);

    // Subsequent valid event must still process cleanly
    const nextEvent: RuntimeEvent<unknown> = {
      sequence: 13,
      type: 'project.registered',
      resourceId: 'proj-next',
      occurredAt: '2026-10-10T12:00:00Z',
      payload: {}
    };
    activeMock.emit('project.registered', JSON.stringify(nextEvent));
    expect(receivedEvents).toHaveLength(4);
    expect(receivedEvents[3].sequence).toBe(13);

    // 5. Test cleanup on unsubscribe
    unsubscribe();
    expect(activeMock.closed).toBe(true);

    // After unsubscribe, emitting events should not invoke callback
    activeMock.emit('project.registered', JSON.stringify({ sequence: 14, type: 'project.registered' }));
    expect(receivedEvents).toHaveLength(4);

    delete globalObj.EventSource;
  });

  it('cleans up server subscription when client closes or disconnects stream', async () => {
    // Wait for any previously aborted streams to fully settle
    await new Promise(resolve => setTimeout(resolve, 100));
    const internalStore = eventStore as unknown as EventStoreInternal;
    const initialListenerCount = internalStore.listeners.size;

    const controller = new AbortController();
    const res = await fetch(`${runtimeUrl}/v1/events`, {
      signal: controller.signal
    });
    expect(res.status).toBe(200);

    // Reader started - listener should have been added
    const reader = res.body?.getReader();
    // Wait for event loop to register subscription
    await new Promise(resolve => setTimeout(resolve, 50));
    expect(internalStore.listeners.size).toBe(initialListenerCount + 1);

    // Disconnect stream
    controller.abort();
    try {
      await reader?.cancel();
    } catch {}

    // Wait for Fastify / Node close event loop tick
    await new Promise(resolve => setTimeout(resolve, 100));

    // Listener must be removed on socket close
    expect(internalStore.listeners.size).toBe(initialListenerCount);
  });
});
