import { newProject } from '@nx/e2e-utils';

export function setupMiscTests() {
  return newProject({
    packages: ['@nx/web', '@nx/angular', '@nx/next'],
  });
}
