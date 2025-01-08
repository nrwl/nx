// This file contains the bits and bobs of the internal API for loading and interacting with Nx plugins.
// For the public API, used by plugin authors, see `./public-api.ts`.

import { join } from 'path';

import { workspaceRoot } from '../../utils/workspace-root';
import { PluginConfiguration } from '../../config/nx-json';
import { shouldMergeAngularProjects } from '../../adapter/angular-json';

import {
  CreateDependencies,
  CreateDependenciesContext,
  CreateMetadata,
  CreateMetadataContext,
  CreateNodesContextV2,
  CreateNodesResult,
  NxPluginV2,
  ProjectsMetadata,
} from './public-api';
import { ProjectGraph } from '../../config/project-graph';
import { loadNxPluginInIsolation } from './isolation';
import { loadNxPlugin, unregisterPluginTSTranspiler } from './loader';
import { createNodesFromFiles } from './utils';
import {
  AggregateCreateNodesError,
  isAggregateCreateNodesError,
} from '../error-types';
import { IS_WASM } from '../../native';
import { RawProjectGraphDependency } from '../project-graph-builder';

export class LoadedNxPlugin {
  readonly name: string;
  readonly createNodes?: [
    filePattern: string,
    // The create nodes function takes all matched files instead of just one, and includes
    // the result's context.
    fn: (
      matchedFiles: string[],
      context: CreateNodesContextV2
    ) => Promise<
      Array<readonly [plugin: string, file: string, result: CreateNodesResult]>
    >
  ];
  readonly createDependencies?: (
    context: CreateDependenciesContext
  ) => Promise<RawProjectGraphDependency[]>;
  readonly createMetadata?: (
    graph: ProjectGraph,
    context: CreateMetadataContext
  ) => Promise<ProjectsMetadata>;

  readonly options?: unknown;
  readonly include?: string[];
  readonly exclude?: string[];

  constructor(plugin: NxPluginV2, pluginDefinition: PluginConfiguration) {
    this.name = plugin.name;
    if (typeof pluginDefinition !== 'string') {
      this.options = pluginDefinition.options;
      this.include = pluginDefinition.include;
      this.exclude = pluginDefinition.exclude;
    }

    if (plugin.createNodes && !plugin.createNodesV2) {
      this.createNodes = [
        plugin.createNodes[0],
        (configFiles, context) =>
          createNodesFromFiles(
            plugin.createNodes[1],
            configFiles,
            this.options,
            context
          ).then((results) => results.map((r) => [this.name, r[0], r[1]])),
      ];
    }

    if (plugin.createNodesV2) {
      this.createNodes = [
        plugin.createNodesV2[0],
        async (configFiles, context) => {
          const result = await plugin.createNodesV2[1](
            configFiles,
            this.options,
            context
          );
          return result.map((r) => [this.name, r[0], r[1]]);
        },
      ];
    }

    if (this.createNodes) {
      const inner = this.createNodes[1];
      this.createNodes[1] = async (...args) => {
        performance.mark(`${plugin.name}:createNodes - start`);
        try {
          return await inner(...args);
        } catch (e) {
          if (isAggregateCreateNodesError(e)) {
            throw e;
          }
          // The underlying plugin errored out. We can't know any partial results.
          throw new AggregateCreateNodesError([[null, e]], []);
        } finally {
          performance.mark(`${plugin.name}:createNodes - end`);
          performance.measure(
            `${plugin.name}:createNodes`,
            `${plugin.name}:createNodes - start`,
            `${plugin.name}:createNodes - end`
          );
        }
      };
    }

    if (plugin.createDependencies) {
      this.createDependencies = async (context) =>
        plugin.createDependencies(this.options, context);
    }

    if (plugin.createMetadata) {
      this.createMetadata = async (graph, context) =>
        plugin.createMetadata(graph, this.options, context);
    }
  }
}

export type CreateNodesResultWithContext = CreateNodesResult & {
  file: string;
  pluginName: string;
};

function isIsolationEnabled() {
  // Explicitly enabled, regardless of further conditions
  if (process.env.NX_ISOLATE_PLUGINS === 'true') {
    return true;
  }
  if (
    // Explicitly disabled
    process.env.NX_ISOLATE_PLUGINS === 'false' ||
    // Isolation is disabled on WASM builds currently.
    IS_WASM
  ) {
    return false;
  }
  // Default value
  return true;
}

/**
 * Use `getPlugins` instead.
 * @deprecated Do not use this. Use `getPlugins` instead.
 */
export async function loadNxPlugins(
  plugins: PluginConfiguration[],
  root = workspaceRoot
): Promise<readonly [LoadedNxPlugin[], () => void]> {
  performance.mark('loadNxPlugins:start');
  const loadingMethod = isIsolationEnabled()
    ? loadNxPluginInIsolation
    : loadNxPlugin;

  plugins = await normalizePlugins(plugins, root);

  const cleanupFunctions: Array<() => void> = [];
  const ret = [
    await Promise.all(
      plugins.map(async (plugin) => {
        const pluginPath = typeof plugin === 'string' ? plugin : plugin.plugin;
        performance.mark(`Load Nx Plugin: ${pluginPath} - start`);

        const [loadedPluginPromise, cleanup] = await loadingMethod(
          plugin,
          root
        );

        cleanupFunctions.push(cleanup);
        const res = await loadedPluginPromise;
        performance.mark(`Load Nx Plugin: ${pluginPath} - end`);
        performance.measure(
          `Load Nx Plugin: ${pluginPath}`,
          `Load Nx Plugin: ${pluginPath} - start`,
          `Load Nx Plugin: ${pluginPath} - end`
        );

        return res;
      })
    ),
    () => {
      for (const fn of cleanupFunctions) {
        fn();
      }
      if (unregisterPluginTSTranspiler) {
        unregisterPluginTSTranspiler();
      }
    },
  ] as const;
  performance.mark('loadNxPlugins:end');
  performance.measure(
    'loadNxPlugins',
    'loadNxPlugins:start',
    'loadNxPlugins:end'
  );
  return ret;
}

async function normalizePlugins(plugins: PluginConfiguration[], root: string) {
  plugins ??= [];

  return [
    ...plugins,
    // Most of the nx core node plugins go on the end, s.t. it overwrites any other plugins
    ...(await getDefaultPlugins(root)),
  ];
}

export async function getDefaultPlugins(root: string) {
  return [
    join(__dirname, '../../plugins/js'),
    ...(shouldMergeAngularProjects(root, false)
      ? [join(__dirname, '../../adapter/angular-json')]
      : []),
    join(__dirname, '../../plugins/package-json'),
    join(__dirname, '../../plugins/project-json/build-nodes/project-json'),
  ];
}
