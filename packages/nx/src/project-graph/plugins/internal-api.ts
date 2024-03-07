// This file contains the bits and bobs of the internal API for loading and interacting with Nx plugins.
// For the public API, used by plugin authors, see `./public-api.ts`.

import { join } from 'path';

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
import { ProjectConfiguration } from '../../config/workspace-json-project-json';
import { retrieveProjectConfigurationsWithoutPluginInference } from '../utils/retrieve-workspace-files';
import { getPluginPathAndName } from './worker-api';
import { getNxRequirePaths } from '../../utils/installation-directory';
import { normalizeNxPlugin } from './utils';

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
export const nxPluginCache: Map<unknown, [Promise<RemotePlugin>, () => void]> =
  new Map();

export async function loadNxPluginsRemotely(
  plugins: PluginConfiguration[],
  root = workspaceRoot
): Promise<[RemotePlugin[], () => void]> {
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

  const cleanupFunctions: Array<() => void> = [];
  for (const plugin of plugins) {
    const [loadedPluginPromise, cleanup] = loadNxPluginRemotely(plugin, root);
    result.push(loadedPluginPromise);
    cleanupFunctions.push(cleanup);
  }

  return [
    await Promise.all(result),
    () => {
      for (const fn of cleanupFunctions) {
        fn();
      }
    },
  ];
}

export function loadNxPluginRemotely(
  plugin: PluginConfiguration,
  root = workspaceRoot
): [Promise<RemotePlugin>, () => void] {
  const cacheKey = JSON.stringify(plugin);

  if (nxPluginCache.has(cacheKey)) {
    return nxPluginCache.get(cacheKey);
  }

  const [loadingPlugin, cleanup] = loadRemoteNxPlugin(plugin, root);
  nxPluginCache.set(cacheKey, [loadingPlugin, cleanup]);
  return [loadingPlugin, cleanup];
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

let projectsWithoutInference: Record<string, ProjectConfiguration>;

export async function loadPlugins(
  plugins: PluginConfiguration[],
  root: string
): Promise<LoadedNxPlugin[]> {
  return await Promise.all(plugins.map((p) => loadPlugin(p, root)));
}

export async function loadPlugin(plugin: PluginConfiguration, root: string) {
  try {
    require.resolve(typeof plugin === 'string' ? plugin : plugin.plugin);
  } catch {
    // If a plugin cannot be resolved, we will need projects to resolve it
    projectsWithoutInference ??=
      await retrieveProjectConfigurationsWithoutPluginInference(root);
  }
  return await loadNxPluginAsync(
    plugin,
    getNxRequirePaths(root),
    projectsWithoutInference,
    root
  );
}

export type LoadedNxPlugin = {
  plugin: NxPlugin;
  options?: unknown;
};

export async function loadNxPluginAsync(
  pluginConfiguration: PluginConfiguration,
  paths: string[],
  projects: Record<string, ProjectConfiguration>,
  root: string
): Promise<LoadedNxPlugin> {
  const { plugin: moduleName, options } =
    typeof pluginConfiguration === 'object'
      ? pluginConfiguration
      : { plugin: pluginConfiguration, options: undefined };

  performance.mark(`Load Nx Plugin: ${moduleName} - start`);
  let { pluginPath, name } = await getPluginPathAndName(
    moduleName,
    paths,
    projects,
    root
  );
  const plugin = normalizeNxPlugin(await importPluginModule(pluginPath));
  plugin.name ??= name;
  performance.mark(`Load Nx Plugin: ${moduleName} - end`);
  performance.measure(
    `Load Nx Plugin: ${moduleName}`,
    `Load Nx Plugin: ${moduleName} - start`,
    `Load Nx Plugin: ${moduleName} - end`
  );
  return { plugin, options };
}

async function importPluginModule(pluginPath: string): Promise<NxPlugin> {
  const m = await import(pluginPath);
  if (
    m.default &&
    ('createNodes' in m.default || 'createDependencies' in m.default)
  ) {
    return m.default;
  }
  return m;
}
