import {
  ModuleFederationSsrDevServerOptions,
  NormalizedModuleFederationSsrDevServerOptions,
} from '../schema';
import { join } from 'path';
import {
  workspaceRoot,
  ExecutorContext,
  parseTargetString,
  readTargetOptions,
} from '@nx/devkit';

export function normalizeOptions(
  options: ModuleFederationSsrDevServerOptions
): NormalizedModuleFederationSsrDevServerOptions {
  return {
    ...options,
    devRemotes: options.devRemotes ?? [],
    verbose: options.verbose ?? false,
    ssl: options.ssl ?? false,
    sslCert: options.sslCert ? join(workspaceRoot, options.sslCert) : undefined,
    sslKey: options.sslKey ? join(workspaceRoot, options.sslKey) : undefined,
  };
}

export function getBuildOptions(buildTarget: string, context: ExecutorContext) {
  const target = parseTargetString(buildTarget, context);

  const buildOptions = readTargetOptions(target, context);

  return {
    ...buildOptions,
  };
}
