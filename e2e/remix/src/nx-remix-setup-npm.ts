import { cleanupProject, killPorts, newProject } from '@nx/e2e-utils';

export function setupNxRemixTestNpm() {
  newProject({
    packages: ['@nx/remix', '@nx/react'],
    packageManager: 'npm',
  });
}

export function cleanupNxRemixTest() {
  killPorts();
  cleanupProject();
}
