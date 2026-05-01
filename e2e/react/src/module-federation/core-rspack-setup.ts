import { cleanupProject, newProject } from '@nx/e2e-utils';

export function setupCoreRspackTest(): void {
  newProject({ packages: ['@nx/react'] });
}

export function cleanupCoreRspackTest(): void {
  cleanupProject();
}
