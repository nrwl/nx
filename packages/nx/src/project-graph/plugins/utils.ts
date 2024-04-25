import { dirname } from 'node:path';

import { toProjectName } from '../../config/workspaces';
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
    performance.mark(`${plugin.name}:createNodes:${file} - start`);
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
    } finally {
      performance.mark(`${plugin.name}:createNodes:${file} - end`);
      performance.measure(
        `${plugin.name}:createNodes:${file}`,
        `${plugin.name}:createNodes:${file} - start`,
        `${plugin.name}:createNodes:${file} - end`
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
