import { dirname } from 'node:path';

import { toProjectName } from '../../config/workspaces';
import { combineGlobPatterns } from '../../utils/globs';

import type { NxPluginV1 } from '../../utils/nx-plugin.deprecated';
import type { NormalizedPlugin, RemotePlugin } from './internal-api';
import type { NxPlugin, NxPluginV2 } from './public-api';

export function isNxPluginV2(plugin: NxPlugin): plugin is NxPluginV2 {
  return 'createNodes' in plugin || 'createDependencies' in plugin;
}

export function isNxPluginV1(
  plugin: NxPlugin | RemotePlugin
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

export class CreateNodesError extends Error {
  constructor(msg, cause: Error | unknown) {
    const message = `${msg} ${
      !cause
        ? ''
        : cause instanceof Error
        ? `\n\n\t Inner Error: ${cause.stack}`
        : cause
    }`;
    // These errors are thrown during a JS callback which is invoked via rust.
    // The errors messaging gets lost in the rust -> js -> rust transition, but
    // logging the error here will ensure that it is visible in the console.
    console.error(message);
    super(message, { cause });
  }
}
