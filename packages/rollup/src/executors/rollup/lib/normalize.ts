import { resolve } from 'path';
import { ExecutorContext } from '@nx/devkit';

import type { RollupExecutorOptions } from '../schema';
import { isUsingTsSolutionSetup } from '@nx/js/src/utils/typescript/ts-solution-setup';

export interface NormalizedRollupExecutorOptions extends RollupExecutorOptions {
  projectRoot: string;
  rollupConfig: string[];
}

export function normalizeRollupExecutorOptions(
  options: RollupExecutorOptions,
  context: ExecutorContext
): NormalizedRollupExecutorOptions {
  const { root } = context;
  const skipTypeCheck = isUsingTsSolutionSetup() ? true : options.skipTypeCheck;
  return {
    ...options,
    rollupConfig: []
      .concat(options.rollupConfig)
      .filter(Boolean)
      .map((p) => normalizePluginPath(p, root)),
    projectRoot: context.projectGraph.nodes[context.projectName].data.root,
    skipTypeCheck: skipTypeCheck || false,
  };
}

export function normalizePluginPath(pluginPath: void | string, root: string) {
  if (!pluginPath) {
    return '';
  }
  try {
    return require.resolve(pluginPath);
  } catch {
    return resolve(root, pluginPath);
  }
}
