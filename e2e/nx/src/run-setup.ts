import { newProject } from '@nx/e2e-utils';

export function setupRunTests() {
  return newProject({ packages: ['@nx/js', '@nx/web', '@nx/node'] });
}
