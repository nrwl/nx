import { cleanupProject, newProject } from '@nx/e2e-utils';

export interface ModuleFederationTestSetup {
  proj: string;
  oldVerboseLoggingValue: string;
}

export function setupModuleFederationTest(): ModuleFederationTestSetup {
  const proj = newProject({
    packages: [
      '@nx/angular',
      '@nx/jest',
      '@nx/vitest',
      '@nx/playwright',
      '@nx/cypress',
    ],
  });
  const oldVerboseLoggingValue = process.env.NX_E2E_VERBOSE_LOGGING;
  process.env.NX_E2E_VERBOSE_LOGGING = 'true';

  return {
    proj,
    oldVerboseLoggingValue,
  };
}

export function cleanupModuleFederationTest(
  setup: ModuleFederationTestSetup | undefined
): void {
  cleanupProject();
  // setup is undefined when setupModuleFederationTest itself failed; don't
  // let cleanup throw and shadow the real error.
  process.env.NX_E2E_VERBOSE_LOGGING = setup?.oldVerboseLoggingValue;
}
