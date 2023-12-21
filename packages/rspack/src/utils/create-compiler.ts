import { ExecutorContext } from '@nx/devkit';
import { Compiler, MultiCompiler, rspack } from '@rspack/core';
import * as path from 'path';
import { RspackExecutorSchema } from '../executors/rspack/schema';

export async function createCompiler(
  options: RspackExecutorSchema,
  context: ExecutorContext
): Promise<Compiler | MultiCompiler> {
  let userDefinedConfig = await import(
    path.join(context.root, options.rspackConfig)
  ).then((x) => x.default || x);

  if (typeof userDefinedConfig.then === 'function') {
    userDefinedConfig = await userDefinedConfig;
  }

  const config = await userDefinedConfig({}, { options, context });

  return rspack(config);
}

export function isMultiCompiler(compiler: Compiler | MultiCompiler): compiler is MultiCompiler {
  return 'compilers' in compiler
}
