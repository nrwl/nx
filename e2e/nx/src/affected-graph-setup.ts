import { cleanupProject, newProject } from '@nx/e2e-utils';

export interface AffectedGraphTestContext {
  proj: string;
}

export function setupAffectedGraphTest(): AffectedGraphTestContext {
  const proj = newProject();
  return { proj };
}

export function cleanupAffectedGraphTest() {
  cleanupProject();
}
