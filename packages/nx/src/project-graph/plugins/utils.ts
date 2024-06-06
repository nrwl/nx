import { dirname } from 'node:path';

import { toProjectName } from '../../config/to-project-name';
import { combineGlobPatterns } from '../../utils/globs';

import type { NxPluginV1 } from '../../utils/nx-plugin.deprecated';
import type { LoadedNxPlugin, NormalizedPlugin } from './internal-api';
import {
  CreateNodesContextV2,
  CreateNodesFunction,
  CreateNodesFunctionV2,
  CreateNodesResult,
  type NxPlugin,
  type NxPluginV2,
} from './public-api';
import { AggregateCreateNodesError } from '../error-types';

export function isNxPluginV2(plugin: NxPlugin): plugin is NxPluginV2 {
  return 'createNodes' in plugin || 'createDependencies' in plugin;
}

export function isNxPluginV1(
  plugin: NxPlugin | LoadedNxPlugin
): plugin is NxPluginV1 {
  return 'processProjectGraph' in plugin || 'projectFilePatterns' in plugin;
}

export function normalizeNxPlugin(plugin: NxPlugin): NormalizedPlugin {
  if (isNxPluginV2(plugin)) {
    return plugin;
  }
  if (isNxPluginV1(plugin) && plugin.projectFilePatterns) {
    return {
      ...plugin,
      createNodes: [
        `*/**/${combineGlobPatterns(plugin.projectFilePatterns)}`,
        (configFilePath) => {
          const root = dirname(configFilePath);
          return {
            projects: {
              [root]: {
                name: toProjectName(configFilePath),
                targets: plugin.registerProjectTargets?.(configFilePath),
              },
            },
          };
        },
      ],
    };
  }
  return plugin;
}

export type AsyncFn<T extends Function> = T extends (
  ...args: infer A
) => infer R
  ? (...args: A) => Promise<Awaited<R>>
  : never;

export async function createNodesFromFiles<T = unknown>(
  createNodes: CreateNodesFunction<T>,
  configFiles: readonly string[],
  options: T,
  context: CreateNodesContextV2
) {
  const results: Array<[file: string, value: CreateNodesResult]> = [];
  const errors: Array<[file: string, error: Error]> = [];

  await Promise.all(
    configFiles.map(async (file) => {
      try {
        const value = await createNodes(file, options, {
          ...context,
          configFiles,
        });
        results.push([file, value] as const);
      } catch (e) {
        errors.push([file, e] as const);
      }
    })
  );

  if (errors.length > 0) {
    throw new AggregateCreateNodesError(errors, results);
  }
  return results;
}
