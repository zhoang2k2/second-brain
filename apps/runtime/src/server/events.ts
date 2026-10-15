import type Database from 'better-sqlite3';
import { RuntimeEvent } from '@zhon/contracts';

export class EventStore {
  private listeners: Set<(event: RuntimeEvent<unknown>) => void> = new Set();

  appendEvent<T>(
    db: Database.Database,
    event: { type: string; resourceId: string; occurredAt: string; payload: T }
  ): RuntimeEvent<T> {
    const stmt = db.prepare(`
      INSERT INTO events (type, resource_id, occurred_at, payload)
      VALUES (?, ?, ?, ?)
    `);

    const result = stmt.run(
      event.type,
      event.resourceId,
      event.occurredAt,
      JSON.stringify(event.payload)
    );

    const sequence = Number(result.lastInsertRowid);

    const runtimeEvent: RuntimeEvent<T> = {
      sequence,
      type: event.type,
      resourceId: event.resourceId,
      occurredAt: event.occurredAt,
      payload: event.payload
    };

    return runtimeEvent;
  }

  recordEvent<T>(
    db: Database.Database,
    event: { type: string; resourceId?: string; occurredAt?: string; payload?: T; data?: T }
  ): RuntimeEvent<T> {
    const payload = (event.data !== undefined ? event.data : event.payload) as T;
    const resourceId =
      event.resourceId ??
      (event.data as { candidate?: { id: string }; vaultId?: string } | undefined)?.candidate?.id ??
      (event.data as { vaultId?: string } | undefined)?.vaultId ??
      'system';
    const occurredAt = event.occurredAt ?? new Date().toISOString();
    const runtimeEvent = this.appendEvent(db, {
      type: event.type,
      resourceId,
      occurredAt,
      payload
    });
    this.publish(runtimeEvent as RuntimeEvent<unknown>);
    return runtimeEvent;
  }

  getEvents(db: Database.Database, afterSequence = 0): RuntimeEvent<unknown>[] {
    const stmt = db.prepare(`
      SELECT sequence, type, resource_id, occurred_at, payload
      FROM events
      WHERE sequence > ?
      ORDER BY sequence ASC
    `);

    const rows = stmt.all(afterSequence) as {
      sequence: number;
      type: string;
      resource_id: string;
      occurred_at: string;
      payload: string;
    }[];

    return rows.map(r => ({
      sequence: r.sequence,
      type: r.type,
      resourceId: r.resource_id,
      occurredAt: r.occurred_at,
      payload: JSON.parse(r.payload)
    }));
  }

  subscribe(listener: (event: RuntimeEvent<unknown>) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  publish(event: RuntimeEvent<unknown>): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch {
        // Listener error should not interrupt dispatch
      }
    }
  }
}
