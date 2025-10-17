import { cleanupProject, newProject } from '@nx/e2e-utils';

export function setupWebLegacyTest() {
  newProject({ packages: ['@nx/web', '@nx/react'] });
}

export function cleanupWebLegacyTest() {
  cleanupProject();
}
