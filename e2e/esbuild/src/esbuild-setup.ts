import { cleanupProject, newProject } from '@nx/e2e-utils';

export function setupEsbuildTest(): string {
  return newProject();
}

export function cleanupEsbuildTest(): void {
  cleanupProject();
}
