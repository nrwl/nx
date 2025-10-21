import { cleanupProject, newProject } from '@nx/e2e-utils';

export function setupIndependentDeployabilityTests() {
  const proj = newProject();
  return proj;
}
