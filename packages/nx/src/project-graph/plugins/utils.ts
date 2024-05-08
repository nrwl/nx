import { dirname } from 'node:path';

import { toProjectName } from '../../config/to-project-name';
import { combineGlobPatterns } from '../../utils/globs';

import type { NxPluginV1 } from '../../utils/nx-plugin.deprecated';
import type {
  CreateNodesResultWithContext,
  LoadedNxPlugin,
  NormalizedPlugin,
} from './internal-api';
import {
  CreateNodesResult,
  type CreateNodesContext,
  type NxPlugin,
  type NxPluginV2,
} from './public-api';
import { AggregateCreateNodesError, CreateNodesError } from '../error-types';
import { performance } from 'perf_hooks';

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

export async function runCreateNodesInParallel(
  configFiles: readonly string[],
  plugin: NormalizedPlugin,
  options: unknown,
  context: CreateNodesContext
): Promise<CreateNodesResultWithContext[]> {
  performance.mark(`${plugin.name}:createNodes - start`);

  const errors: CreateNodesError[] = [];
  const results: CreateNodesResultWithContext[] = [];

  const promises: Array<Promise<void>> = configFiles.map(async (file) => {
    try {
      const value = await plugin.createNodes[1](file, options, context);
      if (value) {
        results.push({
          ...value,
          file,
          pluginName: plugin.name,
        });
      }
    } catch (e) {
      errors.push(
        new CreateNodesError({
          error: e,
          pluginName: plugin.name,
          file,
        })
      );
    }
  });

  await Promise.all(promises).then(() => {
    performance.mark(`${plugin.name}:createNodes - end`);
    performance.measure(
      `${plugin.name}:createNodes`,
      `${plugin.name}:createNodes - start`,
      `${plugin.name}:createNodes - end`
    );
  });

  if (errors.length > 0) {
    throw new AggregateCreateNodesError(plugin.name, errors, results);
  }
  return results;
}
