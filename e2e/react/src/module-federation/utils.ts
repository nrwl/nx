import { readJson, runCLI as _runCLI } from '@nx/e2e/utils';
import { join } from 'path';

export function readPort(appName: string): number {
  let config;
  try {
    config = readJson(join('apps', appName, 'project.json'));
  } catch {
    config = readJson(join(appName, 'project.json'));
  }
  return config.targets.serve.options.port;
}

// Using this function to debug when DB errors occur during MF e2e tests.
export function runCLI(cmd: string, opts?: { env?: Record<string, string> }) {
  return _runCLI(cmd, {
    verbose: true,
    env: {
      ...opts?.env,
      NX_VERBOSE_LOGGING: 'true',
      NX_NATIVE_LOGGING: 'nx::native::db',
    },
  });
}
