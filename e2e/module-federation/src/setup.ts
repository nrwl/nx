import { cleanupProject, newProject } from '@nx/e2e-utils';

// The new `consumer`/`provider` generators ship in @nx/react. The shared
// utils (federation-name validator, version constants) live in
// @nx/module-federation, which @nx/react already depends on - so installing
// react alone is enough.
export function setupModuleFederationV2Test(): void {
  newProject({ packages: ['@nx/react'] });
}

export function cleanupModuleFederationV2Test(): void {
  cleanupProject();
}
