import { z } from 'zod';
import { IDSchema, InstantSchema, CommandSchema } from './common';

export const ProjectSchema = z.object({
  id: IDSchema,
  root: z.string().refine(val => !val.includes('..') && (val.startsWith('/') || val.startsWith('./')), {
    message: 'Root must be absolute or valid relative path without traversal'
  }),
  remote: z.string().optional(),
  version: z.number(),
  createdAt: InstantSchema
});
export type Project = z.infer<typeof ProjectSchema>;

export const VaultSchema = z.object({
  id: IDSchema,
  root: z.string().refine(val => !val.includes('..') && (val.startsWith('/') || val.startsWith('./')), {
    message: 'Root must be absolute or valid relative path without traversal'
  }),
  version: z.number(),
  createdAt: InstantSchema
});
export type Vault = z.infer<typeof VaultSchema>;

export const HealthCheckItemSchema = z.object({
  name: z.string(),
  status: z.enum(['PASS', 'FAIL', 'BLOCKED']),
  message: z.string().optional()
});

export const HealthSchema = z.object({
  ready: z.boolean(),
  checks: z.array(HealthCheckItemSchema)
});
export type Health = z.infer<typeof HealthSchema>;

export const RegistrationInputSchema = z.object({
  root: z.string().refine(val => !val.includes('..') && (val.startsWith('/') || val.startsWith('./')), {
    message: 'Root must be absolute or valid relative path without traversal'
  }),
  remote: z.string().optional()
}).strict();
export type RegistrationInput = z.infer<typeof RegistrationInputSchema>;

export const RegisterProjectCommandSchema = CommandSchema(RegistrationInputSchema);
export type RegisterProjectCommand = z.infer<typeof RegisterProjectCommandSchema>;

export const RegisterVaultCommandSchema = CommandSchema(RegistrationInputSchema);
export type RegisterVaultCommand = z.infer<typeof RegisterVaultCommandSchema>;
