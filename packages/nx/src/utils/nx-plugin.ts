import { existsSync } from 'fs';
import * as path from 'path';
import {
  FileMap,
  ProjectGraph,
  ProjectGraphExternalNode,
} from '../config/project-graph';
import { toProjectName } from '../config/workspaces';

import { workspaceRoot } from './workspace-root';
import { readJsonFile } from '../utils/fileutils';
import {
  PackageJson,
  readModulePackageJsonWithoutFallbacks,
} from './package-json';
import {
  registerTranspiler,
  registerTsConfigPaths,
} from '../plugins/js/utils/register';
import { ProjectConfiguration } from '../config/workspace-json-project-json';
import { logger } from './logger';
import {
  createProjectRootMappingsFromProjectConfigurations,
  findProjectForPath,
} from '../project-graph/utils/find-project-for-path';
import { normalizePath } from './path';
import { dirname, join } from 'path';
import { getNxRequirePaths } from './installation-directory';
import { readTsConfig } from '../plugins/js/utils/typescript';
import { NxJsonConfiguration, PluginConfiguration } from '../config/nx-json';

import type * as ts from 'typescript';
import { retrieveProjectConfigurationsWithoutPluginInference } from '../project-graph/utils/retrieve-workspace-files';
import { NxPluginV1 } from './nx-plugin.deprecated';
import { RawProjectGraphDependency } from '../project-graph/project-graph-builder';
import { combineGlobPatterns } from './globs';
import {
  NxAngularJsonPlugin,
  shouldMergeAngularProjects,
} from '../adapter/angular-json';
import { getNxPackageJsonWorkspacesPlugin } from '../../plugins/package-json-workspaces';
import { CreateProjectJsonProjectsPlugin } from '../plugins/project-json/build-nodes/project-json';
import { FileMapCache } from '../project-graph/nx-deps-cache';
import { CreatePackageJsonProjectsNextToProjectJson } from '../plugins/project-json/build-nodes/package-json-next-to-project-json';

/**
 * Context for {@link CreateNodesFunction}
 */
export interface CreateNodesContext {
  readonly nxJsonConfiguration: NxJsonConfiguration;
  readonly workspaceRoot: string;
}

/**
 * A function which parses a configuration file into a set of nodes.
 * Used for creating nodes for the {@link ProjectGraph}
 */
export type CreateNodesFunction<T = unknown> = (
  projectConfigurationFile: string,
  options: T | undefined,
  context: CreateNodesContext
) => {
  projects?: Record<string, ProjectConfiguration>;
  externalNodes?: Record<string, ProjectGraphExternalNode>;
};

/**
 * A pair of file patterns and {@link CreateNodesFunction}
 */
export type CreateNodes<T = unknown> = readonly [
  projectFilePattern: string,
  createNodesFunction: CreateNodesFunction<T>
];

/**
 * Context for {@link CreateDependencies}
 */
export interface CreateDependenciesContext {
  /**
   * The external nodes that have been added to the graph.
   */
  readonly externalNodes: ProjectGraph['externalNodes'];

  /**
   * The configuration of each project in the workspace.
   */
  readonly projects: Record<string, ProjectConfiguration>;

  /**
   * The `nx.json` configuration from the workspace
   */
  readonly nxJsonConfiguration: NxJsonConfiguration;

  /**
   * All files in the workspace
   */
  readonly fileMap: FileMap;

  /**
   * Files changes since last invocation
   */
  readonly filesToProcess: FileMap;

  readonly workspaceRoot: string;
}

/**
 * A function which parses files in the workspace to create dependencies in the {@link ProjectGraph}
 * Use {@link validateDependency} to validate dependencies
 */
export type CreateDependencies<T = unknown> = (
  options: T | undefined,
  context: CreateDependenciesContext
) => RawProjectGraphDependency[] | Promise<RawProjectGraphDependency[]>;

/**
 * A plugin for Nx which creates nodes and dependencies for the {@link ProjectGraph}
 */
export type NxPluginV2<T = unknown> = {
  name: string;

  /**
   * Provides a file pattern and function that retrieves configuration info from
   * those files. e.g. { '**\/*.csproj': buildProjectsFromCsProjFile }
   */
  createNodes?: CreateNodes<T>;

  // Todo(@AgentEnder): This shouldn't be a full processor, since its only responsible for defining edges between projects. What do we want the API to be?
  /**
   * Provides a function to analyze files to create dependencies for the {@link ProjectGraph}
   */
  createDependencies?: CreateDependencies<T>;
};

export * from './nx-plugin.deprecated';

/**
 * A plugin for Nx
 */
export type NxPlugin = NxPluginV1 | NxPluginV2;

export type LoadedNxPlugin = {
  plugin: NxPluginV2 & Pick<NxPluginV1, 'processProjectGraph'>;
  options?: unknown;
};

// Short lived cache (cleared between cmd runs)
// holding resolved nx plugin objects.
// Allows loadNxPlugins to be called multiple times w/o
// executing resolution mulitple times.
let nxPluginCache: Map<string, LoadedNxPlugin['plugin']> = new Map();

function getPluginPathAndName(
  moduleName: string,
  paths: string[],
  root: string
) {
  let pluginPath: string;
  try {
    pluginPath = require.resolve(moduleName, {
      paths,
    });
  } catch (e) {
    if (e.code === 'MODULE_NOT_FOUND') {
      const plugin = resolveLocalNxPlugin(moduleName, root);
      if (plugin) {
        const main = readPluginMainFromProjectConfiguration(
          plugin.projectConfig
        );
        pluginPath = main ? path.join(root, main) : plugin.path;
      } else {
        logger.error(`Plugin listed in \`nx.json\` not found: ${moduleName}`);
        throw e;
      }
    } else {
      throw e;
    }
  }
  const packageJsonPath = path.join(pluginPath, 'package.json');

  const extension = path.extname(pluginPath);

  // Register the ts-transpiler if we are pointing to a
  // plain ts file that's not part of a plugin project
  if (extension === '.ts' && !tsNodeAndPathsUnregisterCallback) {
    registerPluginTSTranspiler();
  }

  const { name } =
    !['.ts', '.js'].some((x) => x === extension) && // Not trying to point to a ts or js file
    existsSync(packageJsonPath) // plugin has a package.json
      ? readJsonFile(packageJsonPath) // read name from package.json
      : { name: moduleName };
  return { pluginPath, name };
}

export async function loadNxPluginAsync(
  pluginConfiguration: PluginConfiguration,
  paths: string[],
  root: string
): Promise<LoadedNxPlugin> {
  const { plugin: moduleName, options } =
    typeof pluginConfiguration === 'object'
      ? pluginConfiguration
      : { plugin: pluginConfiguration, options: undefined };
  let pluginModule = nxPluginCache.get(moduleName);
  if (pluginModule) {
    return { plugin: pluginModule, options };
  }

  let { pluginPath, name } = getPluginPathAndName(moduleName, paths, root);
  const plugin = ensurePluginIsV2(
    (await import(pluginPath)) as LoadedNxPlugin['plugin']
  );
  plugin.name ??= name;
  nxPluginCache.set(moduleName, plugin);
  return { plugin, options };
}

function loadNxPluginSync(
  pluginConfiguration: PluginConfiguration,
  paths: string[],
  root: string
): LoadedNxPlugin {
  const { plugin: moduleName, options } =
    typeof pluginConfiguration === 'object'
      ? pluginConfiguration
      : { plugin: pluginConfiguration, options: undefined };
  let pluginModule = nxPluginCache.get(moduleName);
  if (pluginModule) {
    return { plugin: pluginModule, options };
  }

  let { pluginPath, name } = getPluginPathAndName(moduleName, paths, root);
  const plugin = ensurePluginIsV2(
    require(pluginPath)
  ) as LoadedNxPlugin['plugin'];
  plugin.name ??= name;
  nxPluginCache.set(moduleName, plugin);
  return { plugin, options };
}

/**
 * @deprecated Use loadNxPlugins instead.
 */
export function loadNxPluginsSync(
  plugins: NxJsonConfiguration['plugins'],
  paths = getNxRequirePaths(),
  root = workspaceRoot
): LoadedNxPlugin[] {
  // TODO: This should be specified in nx.json
  // Temporarily load js as if it were a plugin which is built into nx
  // In the future, this will be optional and need to be specified in nx.json
  const result: LoadedNxPlugin[] = [...getDefaultPluginsSync(root)];

  if (shouldMergeAngularProjects(root, false)) {
    result.push({ plugin: NxAngularJsonPlugin, options: undefined });
  }

  plugins ??= [];
  for (const plugin of plugins) {
    try {
      result.push(loadNxPluginSync(plugin, paths, root));
    } catch (e) {
      if (e.code === 'ERR_REQUIRE_ESM') {
        throw new Error(
          `Unable to load "${plugin}". Plugins cannot be ESM modules. They must be CommonJS modules. Follow the issue on github: https://github.com/nrwl/nx/issues/15682`
        );
      }
      throw e;
    }
  }

  // We push the nx core node plugins onto the end, s.t. it overwrites any other plugins
  result.push(
    { plugin: getNxPackageJsonWorkspacesPlugin(root) },
    { plugin: CreateProjectJsonProjectsPlugin }
  );

  return result;
}

export async function loadNxPlugins(
  plugins: PluginConfiguration[],
  paths = getNxRequirePaths(),
  root = workspaceRoot
): Promise<LoadedNxPlugin[]> {
  const result: LoadedNxPlugin[] = [...(await getDefaultPlugins(root))];

  plugins ??= [];
  for (const plugin of plugins) {
    result.push(await loadNxPluginAsync(plugin, paths, root));
  }

  // We push the nx core node plugins onto the end, s.t. it overwrites any other plugins
  result.push(
    { plugin: getNxPackageJsonWorkspacesPlugin(root) },
    { plugin: CreateProjectJsonProjectsPlugin }
  );

  return result;
}

function ensurePluginIsV2(plugin: NxPlugin): NxPluginV2 {
  if (isNxPluginV2(plugin)) {
    return plugin;
  }
  if (isNxPluginV1(plugin) && plugin.projectFilePatterns) {
    return {
      ...plugin,
      createNodes: [
        `*/**/${combineGlobPatterns(plugin.projectFilePatterns)}`,
        (configFilePath) => {
          const name = toProjectName(configFilePath);
          return {
            projects: {
              [name]: {
                name,
                root: dirname(configFilePath),
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

export function isNxPluginV2(plugin: NxPlugin): plugin is NxPluginV2 {
  return 'createNodes' in plugin || 'createDependencies' in plugin;
}

export function isNxPluginV1(plugin: NxPlugin): plugin is NxPluginV1 {
  return 'processProjectGraph' in plugin || 'projectFilePatterns' in plugin;
}

export function readPluginPackageJson(
  pluginName: string,
  paths = getNxRequirePaths()
): {
  path: string;
  json: PackageJson;
} {
  try {
    const result = readModulePackageJsonWithoutFallbacks(pluginName, paths);
    return {
      json: result.packageJson,
      path: result.path,
    };
  } catch (e) {
    if (e.code === 'MODULE_NOT_FOUND') {
      const localPluginPath = resolveLocalNxPlugin(pluginName);
      if (localPluginPath) {
        const localPluginPackageJson = path.join(
          localPluginPath.path,
          'package.json'
        );
        return {
          path: localPluginPackageJson,
          json: readJsonFile(localPluginPackageJson),
        };
      }
    }
    throw e;
  }
}

/**
 * Builds a plugin package and returns the path to output
 * @param importPath What is the import path that refers to a potential plugin?
 * @returns The path to the built plugin, or null if it doesn't exist
 */
const localPluginCache: Record<
  string,
  { path: string; projectConfig: ProjectConfiguration }
> = {};
export function resolveLocalNxPlugin(
  importPath: string,
  root = workspaceRoot
): { path: string; projectConfig: ProjectConfiguration } | null {
  localPluginCache[importPath] ??= lookupLocalPlugin(importPath, root);
  return localPluginCache[importPath];
}

let tsNodeAndPathsUnregisterCallback = undefined;

/**
 * Register swc-node or ts-node if they are not currently registered
 * with some default settings which work well for Nx plugins.
 */
export function registerPluginTSTranspiler() {
  if (!tsNodeAndPathsUnregisterCallback) {
    // nx-ignore-next-line
    const ts: typeof import('typescript') = require('typescript');

    // Get the first tsconfig that matches the allowed set
    const tsConfigName = [
      join(workspaceRoot, 'tsconfig.base.json'),
      join(workspaceRoot, 'tsconfig.json'),
    ].find((x) => existsSync(x));

    const tsConfig: Partial<ts.ParsedCommandLine> = tsConfigName
      ? readTsConfig(tsConfigName)
      : {};

    const unregisterTsConfigPaths = registerTsConfigPaths(tsConfigName);
    const unregisterTranspiler = registerTranspiler({
      experimentalDecorators: true,
      emitDecoratorMetadata: true,
      ...tsConfig.options,
    });
    tsNodeAndPathsUnregisterCallback = () => {
      unregisterTsConfigPaths();
      unregisterTranspiler();
    };
  }
}

/**
 * Unregister the ts-node transpiler if it is registered
 */
export function unregisterPluginTSTranspiler() {
  if (tsNodeAndPathsUnregisterCallback) {
    tsNodeAndPathsUnregisterCallback();
    tsNodeAndPathsUnregisterCallback = undefined;
  }
}

function lookupLocalPlugin(importPath: string, root = workspaceRoot) {
  const projects = retrieveProjectConfigurationsWithoutPluginInference(root);
  const plugin = findNxProjectForImportPath(importPath, projects, root);
  if (!plugin) {
    return null;
  }

  if (!tsNodeAndPathsUnregisterCallback) {
    registerPluginTSTranspiler();
  }

  const projectConfig: ProjectConfiguration = projects[plugin];
  return { path: path.join(root, projectConfig.root), projectConfig };
}

function findNxProjectForImportPath(
  importPath: string,
  projects: Record<string, ProjectConfiguration>,
  root = workspaceRoot
): string | null {
  const tsConfigPaths: Record<string, string[]> = readTsConfigPaths(root);
  const possiblePaths = tsConfigPaths[importPath]?.map((p) =>
    normalizePath(path.relative(root, path.join(root, p)))
  );
  if (possiblePaths?.length) {
    const projectRootMappings =
      createProjectRootMappingsFromProjectConfigurations(projects);
    for (const tsConfigPath of possiblePaths) {
      const nxProject = findProjectForPath(tsConfigPath, projectRootMappings);
      if (nxProject) {
        return nxProject;
      }
    }
    if (process.env.NX_VERBOSE_LOGGING) {
      console.log(
        'Unable to find local plugin',
        possiblePaths,
        projectRootMappings
      );
    }
    throw new Error(
      'Unable to resolve local plugin with import path ' + importPath
    );
  }
}

let tsconfigPaths: Record<string, string[]>;

function readTsConfigPaths(root: string = workspaceRoot) {
  if (!tsconfigPaths) {
    const tsconfigPath: string | null = ['tsconfig.base.json', 'tsconfig.json']
      .map((x) => path.join(root, x))
      .filter((x) => existsSync(x))[0];
    if (!tsconfigPath) {
      throw new Error('unable to find tsconfig.base.json or tsconfig.json');
    }
    const { compilerOptions } = readJsonFile(tsconfigPath);
    tsconfigPaths = compilerOptions?.paths;
  }
  return tsconfigPaths ?? {};
}

function readPluginMainFromProjectConfiguration(
  plugin: ProjectConfiguration
): string | null {
  const { main } =
    Object.values(plugin.targets).find((x) =>
      [
        '@nx/js:tsc',
        '@nrwl/js:tsc',
        '@nx/js:swc',
        '@nrwl/js:swc',
        '@nx/node:package',
        '@nrwl/node:package',
      ].includes(x.executor)
    )?.options ||
    plugin.targets?.build?.options ||
    {};
  return main;
}

async function getDefaultPlugins(root: string): Promise<LoadedNxPlugin[]> {
  const plugins: NxPluginV2[] = [
    CreatePackageJsonProjectsNextToProjectJson,
    await import('../plugins/js'),
  ];

  if (shouldMergeAngularProjects(root, false)) {
    plugins.push(
      await import('../adapter/angular-json').then((m) => m.NxAngularJsonPlugin)
    );
  }
  return plugins.map((p) => ({
    plugin: p,
  }));
}

function getDefaultPluginsSync(root: string): LoadedNxPlugin[] {
  const plugins: NxPluginV2[] = [require('../plugins/js')];

  if (shouldMergeAngularProjects(root, false)) {
    plugins.push(require('../adapter/angular-json').NxAngularJsonPlugin);
  }
  return plugins.map((p) => ({
    plugin: p,
  }));
}
