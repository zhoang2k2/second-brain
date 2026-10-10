export interface TestProfile {
  name: string;
  env: 'local';
  root: string;
}

export function loadTestProfile(name: string): TestProfile | undefined {
  if (name !== 'fixture-local') return undefined;
  return { name, env: 'local', root: process.cwd() };
}
