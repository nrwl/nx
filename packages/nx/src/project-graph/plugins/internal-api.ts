// This file contains the bits and bobs of the internal API for loading and interacting with Nx plugins.
// For the public API, used by plugin authors, see `./public-api.ts`.


import { join, dirname } from 'path';

import { toProjectName } from '../../config/workspaces';
import { combineGlobPatterns } from '../../utils/globs';
import { workspaceRoot } from '../../utils/workspace-root';
import { PluginConfiguration } from '../../config/nx-json';
import { NxPluginV1 } from '../../utils/nx-plugin.deprecated';
import { shouldMergeAngularProjects } from '../../adapter/angular-json';

import { loadRemoteNxPlugin } from './plugin-pool';
import {
  CreateNodesContext,
  CreateNodesResult,
  NxPlugin,
  NxPluginV2,
} from './public-api';

export type CreateNodesResultWithContext = CreateNodesResult & {
  file: string;
  pluginName: string;
};

export type NormalizedPlugin = NxPluginV2 &
  Pick<NxPluginV1, 'processProjectGraph'>;

// This represents a plugin loaded in a plugin-worker. This is not an API for plugin authors,
// rather an internal representation of how to interact with a loaded plugin.
export type RemotePlugin =
  // A remote plugin is a v2 plugin, with a slightly different API for create nodes.
  Omit<NormalizedPlugin, 'createNodes'> & {
    createNodes: [
      filePattern: string,
      // The create nodes function takes all matched files instead of just one, and includes
      // the result's context.
      fn: (
        matchedFiles: string[],
        context: CreateNodesContext
      ) => Promise<CreateNodesResultWithContext[]>
    ];
  };

// Short lived cache (cleared between cmd runs)
// holding resolved nx plugin objects.
// Allows loaded plugins to not be reloaded when
// referenced multiple times.
export const nxPluginCache: Map<unknown, RemotePlugin> = new Map();

export async function loadNxPlugins(
  plugins: PluginConfiguration[],
  root = workspaceRoot
): Promise<RemotePlugin[]> {
  const result: Promise<RemotePlugin>[] = [];

  plugins ??= [];

  plugins.unshift(
    join(
      __dirname,
      '../../plugins/project-json/build-nodes/package-json-next-to-project-json'
    )
  );

  // We push the nx core node plugins onto the end, s.t. it overwrites any other plugins
  plugins.push(...(await getDefaultPlugins(root)));

  for (const plugin of plugins) {
    result.push(loadNxPlugin(plugin, root));
  }

  return Promise.all(result);
}

export async function loadNxPlugin(
  plugin: PluginConfiguration,
  root = workspaceRoot
): Promise<RemotePlugin> {
  const cacheKey = JSON.stringify(plugin);

  if (nxPluginCache.has(cacheKey)) {
    return nxPluginCache.get(cacheKey)!;
  }

  const loadedPlugin = await loadRemoteNxPlugin(plugin, root);
  nxPluginCache.set(cacheKey, loadedPlugin);
  return loadedPlugin;
}

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

export async function getDefaultPlugins(root: string) {
  return [
    join(__dirname, '../../plugins/js'),
    join(__dirname, '../../plugins/target-defaults/target-defaults-plugin'),
    ...(shouldMergeAngularProjects(root, false)
      ? [join(__dirname, '../../adapter/angular-json')]
      : []),
    join(__dirname, '../../plugins/package-json-workspaces'),
    join(__dirname, '../../plugins/project-json/build-nodes/project-json'),
  ];
}
