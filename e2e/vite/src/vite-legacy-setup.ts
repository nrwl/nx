import { cleanupProject, newProject } from '@nx/e2e-utils';

export function setupViteLegacyTest() {
  const originalEnv = process.env.NX_ADD_PLUGINS;
  process.env.NX_ADD_PLUGINS = 'false';
  const proj = newProject({
    packages: ['@nx/react', '@nx/web'],
  });
  return { proj, originalEnv };
}

export function cleanupViteLegacyTest(originalEnv: string) {
  process.env.NX_ADD_PLUGINS = originalEnv;
  cleanupProject();
}
