import type {
  CreateDependencies,
  CreateDependenciesContext,
} from '@nx/devkit';
import { buildExplicitDependencies } from 'nx/src/plugins/js/project-graph/build-dependencies/build-dependencies';
import { jsPluginConfig } from 'nx/src/plugins/js/utils/config';
import { narrowDependencies } from './narrow-dependencies';
import {
  normalizeOptions,
  type NodeTreeShakePluginOptions,
} from './options';
import type { RawDependency } from './types';

export const createDependencies: CreateDependencies<
  NodeTreeShakePluginOptions
> = async (
  options: NodeTreeShakePluginOptions | undefined,
  context: CreateDependenciesContext
) => {
  const normalizedOptions = normalizeOptions(options);
  const pluginConfig = jsPluginConfig(
    context.nxJsonConfiguration as Record<string, unknown> | undefined
  );
  const baseDependencies = buildExplicitDependencies(
    {
      ...pluginConfig,
      analyzeSourceFiles: true,
      analyzePackageJson: true,
    },
    context
  ) as RawDependency[];

  if (normalizedOptions.passthrough) {
    return baseDependencies as never;
  }

  return (await narrowDependencies(
    baseDependencies,
    context,
    normalizedOptions
  )) as never;
};