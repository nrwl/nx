import { ExecutorContext } from '@nx/devkit';
import type { Compiler, Configuration, MultiCompiler } from '@rspack/core';

import { NormalizedRspackExecutorSchema } from '../executors/rspack/schema';
import { getRspackConfigs } from '../executors/rspack/lib/config';
import { loadRspackCore } from './load-rspack-core';

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

  // Lazy-loaded to avoid resolving @rspack/core (pure ESM) before a build runs; see load-rspack-core.ts.
  const { rspack } = loadRspackCore();
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
