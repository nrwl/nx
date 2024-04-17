import { dirname } from 'node:path';

import { toProjectName } from '../../config/workspaces';
import { combineGlobPatterns } from '../../utils/globs';

import type { NxPluginV1 } from '../../utils/nx-plugin.deprecated';
import type {
  CreateNodesResultWithContext,
  LoadedNxPlugin,
  NormalizedPlugin,
} from './internal-api';
import type { CreateNodesContext, NxPlugin, NxPluginV2 } from './public-api';
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
  configFiles: string[],
  plugin: NormalizedPlugin,
  options: unknown,
  context: CreateNodesContext
): Promise<CreateNodesResultWithContext[]> {
  performance.mark(`${plugin.name}:createNodes - start`);

  const errors: CreateNodesError[] = [];
  const results: CreateNodesResultWithContext[] = [];

  const promises: Array<Promise<void>> = configFiles.map((file) => {
    performance.mark(`${plugin.name}:createNodes:${file} - start`);
    // Result is either static or a promise, using Promise.resolve lets us
    // handle both cases with same logic
    const value = Promise.resolve(
      plugin.createNodes[1](file, options, context)
    );
    return value
      .catch((e) => {
        performance.mark(`${plugin.name}:createNodes:${file} - end`);
        errors.push(
          new CreateNodesError({
            error: e,
            pluginName: plugin.name,
            file,
          })
        );
        return null;
      })
      .then((r) => {
        performance.mark(`${plugin.name}:createNodes:${file} - end`);
        performance.measure(
          `${plugin.name}:createNodes:${file}`,
          `${plugin.name}:createNodes:${file} - start`,
          `${plugin.name}:createNodes:${file} - end`
        );

        // Existing behavior is to ignore null results of
        // createNodes function.
        if (r) {
          results.push({ ...r, file, pluginName: plugin.name });
        }
      });
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
