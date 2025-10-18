import { cleanupProject, newProject, uniq } from '@nx/e2e-utils';

export interface CypressTestContext {
  myapp: string;
}

export function setupCypressTest(): CypressTestContext {
  const myapp = uniq('myapp');
  newProject({ packages: ['@nx/angular', '@nx/next', '@nx/react'] });
  return { myapp };
}

export function cleanupCypressTest() {
  cleanupProject();
}
