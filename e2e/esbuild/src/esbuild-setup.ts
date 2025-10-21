import { cleanupProject, newProject } from '@nx/e2e-utils';

export function setupEsbuildTest(): string {
  return newProject({ packages: ['@nx/js'] });
}

export function cleanupEsbuildTest(): void {
  cleanupProject();
}
