import { sync } from 'fast-glob';
import { existsSync } from 'fs';
import * as path from 'path';
import { ProjectGraphProcessor } from '../config/project-graph';
import { Workspaces } from '../config/workspaces';

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
import {
  ProjectConfiguration,
  ProjectsConfigurations,
  TargetConfiguration,
} from '../config/workspace-json-project-json';
import { logger } from './logger';
import {
  createProjectRootMappingsFromProjectConfigurations,
  findProjectForPath,
} from '../project-graph/utils/find-project-for-path';
import { normalizePath } from './path';
import { join } from 'path';
import { getNxRequirePaths } from './installation-directory';
import { readTsConfig } from '../plugins/js/utils/typescript';

import type * as ts from 'typescript';

export type ProjectTargetConfigurator = (
  file: string
) => Record<string, TargetConfiguration>;

/**
 * A plugin for Nx
 */
export interface NxPlugin {
  name: string;
  processProjectGraph?: ProjectGraphProcessor;
  registerProjectTargets?: ProjectTargetConfigurator;

  /**
   * A glob pattern to search for non-standard project files.
   * @example: ["*.csproj", "pom.xml"]
   */
  projectFilePatterns?: string[];
}

// Short lived cache (cleared between cmd runs)
// holding resolved nx plugin objects.
// Allows loadNxPlugins to be called multiple times w/o
// executing resolution mulitple times.
let nxPluginCache: Map<string, NxPlugin> = new Map();

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

  const { name } =
    !['.ts', '.js'].some((x) => x === path.extname(pluginPath)) && // Not trying to point to a ts or js file
    existsSync(packageJsonPath) // plugin has a package.json
      ? readJsonFile(packageJsonPath) // read name from package.json
      : { name: moduleName };
  return { pluginPath, name };
}

export async function loadNxPluginAsync(
  moduleName: string,
  paths: string[],
  root: string
) {
  let pluginModule = nxPluginCache.get(moduleName);
  if (pluginModule) {
    return pluginModule;
  }

  let { pluginPath, name } = getPluginPathAndName(moduleName, paths, root);
  const plugin = (await import(pluginPath)) as NxPlugin;
  plugin.name = name;
  nxPluginCache.set(moduleName, plugin);
  return plugin;
}

function loadNxPluginSync(moduleName: string, paths: string[], root: string) {
  let pluginModule = nxPluginCache.get(moduleName);
  if (pluginModule) {
    return pluginModule;
  }

  let { pluginPath, name } = getPluginPathAndName(moduleName, paths, root);
  const plugin = require(pluginPath) as NxPlugin;
  plugin.name = name;
  nxPluginCache.set(moduleName, plugin);
  return plugin;
}

/**
 * @deprecated Use loadNxPlugins instead.
 */
export function loadNxPluginsSync(
  plugins?: string[],
  paths = getNxRequirePaths(),
  root = workspaceRoot
): NxPlugin[] {
  const result: NxPlugin[] = [];

  // TODO: This should be specified in nx.json
  // Temporarily load js as if it were a plugin which is built into nx
  // In the future, this will be optional and need to be specified in nx.json
  const jsPlugin: any = require('../plugins/js');
  jsPlugin.name = 'nx-js-graph-plugin';
  result.push(jsPlugin as NxPlugin);

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

  return result;
}

export async function loadNxPlugins(
  plugins?: string[],
  paths = getNxRequirePaths(),
  root = workspaceRoot
): Promise<NxPlugin[]> {
  const result: NxPlugin[] = [];

  // TODO: This should be specified in nx.json
  // Temporarily load js as if it were a plugin which is built into nx
  // In the future, this will be optional and need to be specified in nx.json
  const jsPlugin: any = await import('../plugins/js');
  jsPlugin.name = 'nx-js-graph-plugin';
  result.push(jsPlugin as NxPlugin);

  plugins ??= [];
  for (const plugin of plugins) {
    result.push(await loadNxPluginAsync(plugin, paths, root));
  }

  return result;
}

export function mergePluginTargetsWithNxTargets(
  projectRoot: string,
  targets: Record<string, TargetConfiguration>,
  plugins: NxPlugin[]
): Record<string, TargetConfiguration> {
  let newTargets: Record<string, TargetConfiguration> = {};
  for (const plugin of plugins) {
    if (!plugin.projectFilePatterns?.length || !plugin.registerProjectTargets) {
      continue;
    }

    const projectFiles = sync(`+(${plugin.projectFilePatterns.join('|')})`, {
      cwd: path.join(workspaceRoot, projectRoot),
    });
    for (const projectFile of projectFiles) {
      newTargets = {
        ...newTargets,
        ...plugin.registerProjectTargets(path.join(projectRoot, projectFile)),
      };
    }
  }
  return { ...newTargets, ...targets };
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

let tsNodeAndPathsRegistered = false;

/**
 * Register swc-node or ts-node if they are not currently registered
 * with some default settings which work well for Nx plugins.
 */
export function registerPluginTSTranspiler() {
  if (!tsNodeAndPathsRegistered) {
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

    registerTsConfigPaths(tsConfigName);
    registerTranspiler({
      experimentalDecorators: true,
      emitDecoratorMetadata: true,
      ...tsConfig.options,
      lib: ['es2021'],
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2021,
      inlineSourceMap: true,
      skipLibCheck: true,
    });
  }
  tsNodeAndPathsRegistered = true;
}

function lookupLocalPlugin(importPath: string, root = workspaceRoot) {
  const workspace = new Workspaces(root).readProjectsConfigurations({
    _ignorePluginInference: true,
  });
  const plugin = findNxProjectForImportPath(importPath, workspace, root);
  if (!plugin) {
    return null;
  }

  if (!tsNodeAndPathsRegistered) {
    registerPluginTSTranspiler();
  }

  const projectConfig = workspace.projects[plugin];
  return { path: path.join(root, projectConfig.root), projectConfig };
}

function findNxProjectForImportPath(
  importPath: string,
  projects: ProjectsConfigurations,
  root = workspaceRoot
): string | null {
  const tsConfigPaths: Record<string, string[]> = readTsConfigPaths(root);
  const possiblePaths = tsConfigPaths[importPath]?.map((p) =>
    normalizePath(path.relative(root, path.join(root, p)))
  );
  if (possiblePaths?.length) {
    const projectRootMappings =
      createProjectRootMappingsFromProjectConfigurations(projects.projects);
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
