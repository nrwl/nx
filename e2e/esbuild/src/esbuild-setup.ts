import { cleanupProject, newProject } from '@nx/e2e-utils';

export function setupEsbuildTest(): string {
  return newProject({
    packages: ['@nx/js', '@nx/esbuild', '@nx/eslint', '@nx/jest'],
  });
}

export function cleanupEsbuildTest(): void {
  cleanupProject();
}
