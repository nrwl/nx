import { cleanupProject, newProject } from '@nx/e2e-utils';

export interface ModuleFederationTestSetup {
  proj: string;
  oldVerboseLoggingValue: string;
}

export function setupModuleFederationTest(): ModuleFederationTestSetup {
  const proj = newProject({ packages: ['@nx/angular'] });
  const oldVerboseLoggingValue = process.env.NX_E2E_VERBOSE_LOGGING;
  process.env.NX_E2E_VERBOSE_LOGGING = 'true';

  return {
    proj,
    oldVerboseLoggingValue,
  };
}

export function cleanupModuleFederationTest(
  setup: ModuleFederationTestSetup
): void {
  cleanupProject();
  process.env.NX_E2E_VERBOSE_LOGGING = setup.oldVerboseLoggingValue;
}
