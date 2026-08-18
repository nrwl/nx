import { cleanupProject, newProject } from '@nx/e2e-utils';

export function setupCoreRspackTest(): void {
  newProject({
    packages: [
      '@nx/react',
      '@nx/rspack',
      '@nx/jest',
      '@nx/cypress',
      '@nx/playwright',
    ],
  });
}

export function cleanupCoreRspackTest(): void {
  cleanupProject();
}
