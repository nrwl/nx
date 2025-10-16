import { cleanupProject, killPorts, newProject } from '@nx/e2e-utils';

export function setupNxRemixTestYarn() {
  // prevent corepack from detecting parent workspace's packageManager field
  // which would override the --package-manager=yarn flag passed to create-nx-workspace
  process.env.COREPACK_ENABLE_PROJECT_SPEC = '0';

  newProject({
    packages: ['@nx/remix', '@nx/react'],
    packageManager: 'yarn',
  });
}

export function cleanupNxRemixTest() {
  killPorts();
  cleanupProject();
  delete process.env.COREPACK_ENABLE_PROJECT_SPEC;
}
