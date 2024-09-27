import { ExecutorContext } from '@nx/devkit';
import {
  Compiler,
  type Configuration,
  MultiCompiler,
  rspack,
} from '@rspack/core';
import * as path from 'path';
import { RspackExecutorSchema } from '../executors/rspack/schema';
import { resolveUserDefinedRspackConfig } from './resolve-user-defined-rspack-config';

export async function createCompiler(
  options: RspackExecutorSchema & {
    devServer?: any;
  },
  context: ExecutorContext
): Promise<Compiler | MultiCompiler> {
  const pathToConfig = path.join(context.root, options.rspackConfig);
  let userDefinedConfig: any = {};
  if (options.tsConfig) {
    userDefinedConfig = resolveUserDefinedRspackConfig(
      pathToConfig,
      options.tsConfig
    );
  } else {
    userDefinedConfig = await import(pathToConfig).then((x) => x.default || x);
  }

  if (typeof userDefinedConfig.then === 'function') {
    userDefinedConfig = await userDefinedConfig;
  }

  let config: Configuration = {};
  if (typeof userDefinedConfig === 'function') {
    config = await userDefinedConfig(
      { devServer: options.devServer },
      { options, context }
    );
  } else {
    config = userDefinedConfig;
    config.devServer ??= options.devServer;
  }

  return rspack(config);
}

export function isMultiCompiler(
  compiler: Compiler | MultiCompiler
): compiler is MultiCompiler {
  return 'compilers' in compiler;
}
