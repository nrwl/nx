import { cleanupProject, newProject } from '@nx/e2e-utils';

// The `consumer`/`provider` generators ship in @nx/react and emit the
// official Module Federation plugins, so installing react alone is enough.
export function setupModuleFederationV2Test(): void {
  newProject({ packages: ['@nx/react'] });
}

export function cleanupModuleFederationV2Test(): void {
  cleanupProject();
}
