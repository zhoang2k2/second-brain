import { Project, Vault, Health, RegistrationInput } from './foundation';
import { ApiError } from './common';

export const validProjectFixture: Project = {
  id: 'proj-123',
  root: '/fixture/project',
  remote: 'https://github.com/example/repo.git',
  version: 1,
  createdAt: '2026-10-10T10:00:00Z'
};

export const invalidProjectFixture = {
  id: 'proj-bad',
  root: '/fixture/../escape',
  version: 1,
  createdAt: '2026-10-10T10:00:00Z'
};

export const validVaultFixture: Vault = {
  id: 'vault-123',
  root: '/fixture/vault',
  version: 1,
  createdAt: '2026-10-10T10:00:00Z'
};

export const invalidVaultFixture = {
  id: 'vault-bad',
  root: '../escape',
  version: 1,
  createdAt: '2026-10-10T10:00:00Z'
};

export const validHealthFixture: Health = {
  ready: true,
  checks: [
    { name: 'database', status: 'PASS' },
    { name: 'storage', status: 'PASS' }
  ]
};

export const degradedHealthFixture: Health = {
  ready: false,
  checks: [
    { name: 'database', status: 'FAIL', message: 'Connection timeout' },
    { name: 'adapter', status: 'BLOCKED', message: 'Prerequisite missing' }
  ]
};

export const validRegistrationInputFixture: RegistrationInput = {
  root: '/fixture/target',
  remote: 'https://github.com/example/target.git'
};

export const invalidRegistrationInputFixture = {
  root: '/fixture/../escape',
  grantAll: true
};

export const apiErrorFixture: ApiError = {
  code: 'VALIDATION_ERROR',
  message: 'Invalid input provided',
  retryable: false
};
