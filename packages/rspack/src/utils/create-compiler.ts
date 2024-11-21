import { ExecutorContext } from '@nx/devkit';
import {
  Compiler,
  type Configuration,
  MultiCompiler,
  rspack,
} from '@rspack/core';

import { NormalizedRspackExecutorSchema } from '../executors/rspack/schema';
import { getRspackConfigs } from '../executors/rspack/lib/config';

export async function createCompiler(
  options: NormalizedRspackExecutorSchema & {
    devServer?: any;
  },
  context: ExecutorContext
): Promise<Compiler | MultiCompiler> {
  const config = await getRspackConfigs(options, context);

  if (!options.standardRspackConfigFunction) {
    validateConfig(config);
  }

  return rspack(config);
}

export function isMultiCompiler(
  compiler: Compiler | MultiCompiler
): compiler is MultiCompiler {
  return 'compilers' in compiler;
}

function validateConfig(config: Configuration | Configuration[]) {
  [config].flat().forEach((config) => {
    if (!config.entry) {
      throw new Error(
        'Entry is required. Please set the `main` option in the executor or the `entry` property in the rspack config.'
      );
    }
    if (!config.output) {
      throw new Error(
        'Output is required. Please set the `outputPath` option in the executor or the `output` property in the rspack config.'
      );
    }
  });
}
