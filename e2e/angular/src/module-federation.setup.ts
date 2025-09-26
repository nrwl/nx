import { cleanupProject, newProject, readJson } from '@nx/e2e-utils';
import { join } from 'path';

let projName: string;
let previousVerboseLogging: string | undefined;

export function setupModuleFederationSuite() {
  beforeAll(() => {
    projName = newProject({ packages: ['@nx/angular'] });
    previousVerboseLogging = process.env.NX_E2E_VERBOSE_LOGGING;
    process.env.NX_E2E_VERBOSE_LOGGING = 'true';
  });

  afterAll(() => {
    cleanupProject();
    if (previousVerboseLogging === undefined) {
      delete process.env.NX_E2E_VERBOSE_LOGGING;
    } else {
      process.env.NX_E2E_VERBOSE_LOGGING = previousVerboseLogging;
    }
  });
}

export function getModuleFederationProjectName() {
  return projName;
}

export function readPort(appName: string): number {
  try {
    return readJson(join('apps', appName, 'project.json')).targets.serve.options
      .port as number;
  } catch {
    return readJson(join(appName, 'project.json')).targets.serve.options
      .port as number;
  }
}
