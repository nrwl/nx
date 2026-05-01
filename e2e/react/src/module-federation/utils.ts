import { readJson, RunCmdOpts, runCLI as _runCLI } from '@nx/e2e-utils';
import { join } from 'path';

export function readPort(appName: string): number {
  let config;
  try {
    config = readJson(join('apps', appName, 'project.json'));
  } catch {
    try {
      config = readJson(join(appName, 'project.json'));
    } catch {
      // TS Solution setup uses package.json
      const pkgJson = readJson(join(appName, 'package.json'));
      return pkgJson.nx?.targets?.serve?.options?.port;
    }
  }
  return config.targets.serve.options.port;
}

// Using this function to debug when DB errors occur during MF e2e tests.
export function runCLI(cmd: string, opts?: RunCmdOpts) {
  return _runCLI(cmd, {
    ...opts,
    verbose: true,
    env: {
      ...opts?.env,
      NX_VERBOSE_LOGGING: 'true',
      NX_NATIVE_LOGGING: 'nx::native::db',
    },
  });
}
