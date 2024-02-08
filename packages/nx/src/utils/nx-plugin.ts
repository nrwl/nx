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
import {
  NxJsonConfiguration,
  PluginConfiguration,
  readNxJson,
} from '../config/nx-json';

import type * as ts from 'typescript';
import { NxPluginV1 } from './nx-plugin.deprecated';
import { RawProjectGraphDependency } from '../project-graph/project-graph-builder';
import { combineGlobPatterns } from './globs';
import { shouldMergeAngularProjects } from '../adapter/angular-json';
import { getNxPackageJsonWorkspacesPlugin } from '../plugins/package-json-workspaces';
import { ProjectJsonProjectsPlugin } from '../plugins/project-json/build-nodes/project-json';
import { PackageJsonProjectsNextToProjectJsonPlugin } from '../plugins/project-json/build-nodes/package-json-next-to-project-json';
import { retrieveProjectConfigurationsWithoutPluginInference } from '../project-graph/utils/retrieve-workspace-files';
import { TargetDefaultsPlugin } from '../plugins/target-defaults/target-defaults-plugin';

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
) => CreateNodesResult | Promise<CreateNodesResult>;

export interface CreateNodesResult {
  /**
   * A map of project root -> project configuration
   */
  projects?: Record<string, Optional<ProjectConfiguration, 'root'>>;

  /**
   * A map of external node name -> external node. External nodes do not have a root, so the key is their name.
   */
  externalNodes?: Record<string, ProjectGraphExternalNode>;
}

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
export type NxPluginV2<TOptions = unknown> = {
  name: string;

  /**
   * Provides a file pattern and function that retrieves configuration info from
   * those files. e.g. { '**\/*.csproj': buildProjectsFromCsProjFile }
   */
  createNodes?: CreateNodes;

  // Todo(@AgentEnder): This shouldn't be a full processor, since its only responsible for defining edges between projects. What do we want the API to be?
  /**
   * Provides a function to analyze files to create dependencies for the {@link ProjectGraph}
   */
  createDependencies?: CreateDependencies<TOptions>;
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
export const nxPluginCache: Map<string, LoadedNxPlugin['plugin']> = new Map();

export function getPluginPathAndName(
  moduleName: string,
  paths: string[],
  projects: Record<string, ProjectConfiguration>,
  root: string
) {
  let pluginPath: string;
  try {
    pluginPath = require.resolve(moduleName, {
      paths,
    });
  } catch (e) {
    if (e.code === 'MODULE_NOT_FOUND') {
      const plugin = resolveLocalNxPlugin(
        moduleName,
        readNxJson(root),
        projects,
        root
      );
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
  projects: Record<string, ProjectConfiguration>,
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
  performance.mark(`Load Nx Plugin: ${moduleName} - start`);
  let { pluginPath, name } = await getPluginPathAndName(
    moduleName,
    paths,
    projects,
    root
  );
  const plugin = ensurePluginIsV2(
    (await import(pluginPath)) as LoadedNxPlugin['plugin']
  );
  plugin.name ??= name;
  nxPluginCache.set(moduleName, plugin);
  performance.mark(`Load Nx Plugin: ${moduleName} - end`);
  performance.measure(
    `Load Nx Plugin: ${moduleName}`,
    `Load Nx Plugin: ${moduleName} - start`,
    `Load Nx Plugin: ${moduleName} - end`
  );
  return { plugin, options };
}

export async function loadNxPlugins(
  plugins: PluginConfiguration[],
  paths = getNxRequirePaths(),
  root = workspaceRoot,
  projects?: Record<string, ProjectConfiguration>
): Promise<LoadedNxPlugin[]> {
  const result: LoadedNxPlugin[] = [
    { plugin: PackageJsonProjectsNextToProjectJsonPlugin },
  ];

  plugins ??= [];

  // When loading plugins for `createNodes`, we don't know what projects exist yet.
  // Try resolving plugins
  for (const plugin of plugins) {
    try {
      require.resolve(typeof plugin === 'string' ? plugin : plugin.plugin);
    } catch {
      // If a plugin cannot be resolved, we will need projects to resolve it
      projects ??= await retrieveProjectConfigurationsWithoutPluginInference(
        root
      );
      break;
    }
  }
  for (const plugin of plugins) {
    result.push(await loadNxPluginAsync(plugin, paths, projects, root));
  }

  // We push the nx core node plugins onto the end, s.t. it overwrites any other plugins
  result.push(...(await getDefaultPlugins(root)));

  return result;
}

export function ensurePluginIsV2(plugin: NxPlugin): NxPluginV2 {
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
                root,
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
  projects: Record<string, ProjectConfiguration>,
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
      const nxJson = readNxJson();
      const localPluginPath = resolveLocalNxPlugin(
        pluginName,
        nxJson,
        projects
      );
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
  nxJsonConfiguration: NxJsonConfiguration,
  projects: Record<string, ProjectConfiguration>,
  root = workspaceRoot
): { path: string; projectConfig: ProjectConfiguration } | null {
  localPluginCache[importPath] ??= lookupLocalPlugin(
    importPath,
    nxJsonConfiguration,
    projects,
    root
  );
  return localPluginCache[importPath];
}

let tsNodeAndPathsUnregisterCallback: (() => void) | undefined = undefined;

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
    const unregisterTranspiler = registerTranspiler(
      {
        experimentalDecorators: true,
        emitDecoratorMetadata: true,
        ...tsConfig.options,
      },
      tsConfig.raw
    );
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

function lookupLocalPlugin(
  importPath: string,
  nxJsonConfiguration: NxJsonConfiguration,
  projects: Record<string, ProjectConfiguration>,
  root = workspaceRoot
) {
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

export async function getDefaultPlugins(
  root: string
): Promise<LoadedNxPlugin[]> {
  const plugins: NxPluginV2[] = [
    await import('../plugins/js'),
    TargetDefaultsPlugin,
    ...(shouldMergeAngularProjects(root, false)
      ? [
          await import('../adapter/angular-json').then(
            (m) => m.NxAngularJsonPlugin
          ),
        ]
      : []),
    getNxPackageJsonWorkspacesPlugin(root),
    ProjectJsonProjectsPlugin,
  ];

  return plugins.map((p) => ({
    plugin: p,
  }));
}

type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;
