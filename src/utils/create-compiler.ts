import { ExecutorContext } from '@nx/devkit';
import { Compiler, createCompiler as _createCompiler } from '@rspack/core';
import * as path from 'path';
import { RspackExecutorSchema } from '../executors/rspack/schema';

export async function createCompiler(
  options: RspackExecutorSchema,
  context: ExecutorContext
): Promise<Compiler> {
  let userDefinedConfig = await import(
    path.join(context.root, options.rspackConfig)
  ).then((x) => x.default || x);

  if (typeof userDefinedConfig.then === 'function') {
    userDefinedConfig = await userDefinedConfig;
  }

  const config = await userDefinedConfig({}, { options, context });

  return _createCompiler(config);
}
