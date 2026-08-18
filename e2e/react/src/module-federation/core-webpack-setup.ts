import { cleanupProject, newProject } from '@nx/e2e-utils';

export function setupCoreWebpackTest(): void {
  newProject({
    packages: [
      '@nx/react',
      '@nx/webpack',
      '@nx/jest',
      '@nx/cypress',
      '@nx/playwright',
    ],
  });
}

export function cleanupCoreWebpackTest(): void {
  cleanupProject();
}
