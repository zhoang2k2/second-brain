export interface TestProfile {
  id: string;
  name?: string;
  env?: 'local' | 'ci';
  root?: string;
  projectRoots: string[];
  vaultRoot: string;
  providerCredentialRef?: string;
  engineManifestIds?: string[];
  remoteTargetSha?: string;
}

export function loadTestProfile(name: string): TestProfile | undefined {
  if (name !== 'fixture-local') return undefined;
  const root = process.cwd();
  return {
    id: name,
    name,
    env: 'local',
    root,
    projectRoots: [root],
    vaultRoot: root,
    engineManifestIds: []
  };
}
