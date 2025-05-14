import {
  ExecutorContext,
  parseTargetString,
  readTargetOptions,
} from '@nx/devkit';
import {
  ModuleFederationDevServerOptions,
  NormalizedModuleFederationDevServerOptions,
} from '../schema';

export function getBuildOptions(buildTarget: string, context: ExecutorContext) {
  const target = parseTargetString(buildTarget, context);

  const buildOptions = readTargetOptions(target, context);

  return {
    ...buildOptions,
  };
}

export function normalizeOptions(
  options: ModuleFederationDevServerOptions
): NormalizedModuleFederationDevServerOptions {
  return {
    ...options,
    devRemotes: options.devRemotes ?? [],
    verbose: options.verbose ?? false,
  };
}
