import { z } from 'zod';

export const IDSchema = z.string();
export type ID = z.infer<typeof IDSchema>;

export const InstantSchema = z.string();
export type Instant = z.infer<typeof InstantSchema>;

export const ApiErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  retryable: z.boolean()
});
export type ApiError = z.infer<typeof ApiErrorSchema>;

export const ResultSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.discriminatedUnion('ok', [
    z.object({ ok: z.literal(true), value: dataSchema }),
    z.object({ ok: z.literal(false), error: ApiErrorSchema })
  ]);
export type Result<T> = 
  | { ok: true; value: T }
  | { ok: false; error: ApiError };

export const CommandSchema = <T extends z.ZodTypeAny>(payloadSchema: T) =>
  z.object({
    requestId: IDSchema,
    idempotencyKey: IDSchema,
    expectedVersion: z.number().optional(),
    payload: payloadSchema
  }).strict();
export type Command<T> = {
  requestId: ID;
  idempotencyKey: ID;
  expectedVersion?: number;
  payload: T;
};

export const RuntimeEventSchema = <T extends z.ZodTypeAny>(payloadSchema: T) =>
  z.object({
    sequence: z.number(),
    type: z.string(),
    resourceId: IDSchema,
    occurredAt: InstantSchema,
    payload: payloadSchema
  }).strict();
export type RuntimeEvent<T> = {
  sequence: number;
  type: string;
  resourceId: ID;
  occurredAt: Instant;
  payload: T;
};

export const ScopeSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('global') }),
  z.object({ kind: z.literal('project'), projectId: IDSchema })
]);
export type Scope = z.infer<typeof ScopeSchema>;
