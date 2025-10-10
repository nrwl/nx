import { cleanupProject, killPorts, newProject } from '@nx/e2e-utils';

export function setupNxRemixTestYarn() {
  newProject({
    packages: ['@nx/remix', '@nx/react'],
    packageManager: 'yarn',
  });
}

export function cleanupNxRemixTest() {
  killPorts();
  cleanupProject();
}
