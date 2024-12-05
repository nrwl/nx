// This file contains methods and utilities that should **only** be used by the plugin worker.

import { ProjectConfiguration } from '../../config/workspace-json-project-json';

import { join } from 'node:path/posix';
import { getNxRequirePaths } from '../../utils/installation-directory';
import {
  PackageJson,
  readModulePackageJsonWithoutFallbacks,
} from '../../utils/package-json';
import { readJsonFile } from '../../utils/fileutils';
import { workspaceRoot } from '../../utils/workspace-root';
import { existsSync } from 'node:fs';
import {
  registerTranspiler,
  registerTsConfigPaths,
} from '../../plugins/js/utils/register';
import {
  ProjectRootMappings,
  findProjectForPath,
} from '../utils/find-project-for-path';
import { normalizePath } from '../../utils/path';
import { logger } from '../../utils/logger';

import type * as ts from 'typescript';
import { extname } from 'node:path';
import type { PluginConfiguration } from '../../config/nx-json';
import { retrieveProjectConfigurationsWithoutPluginInference } from '../utils/retrieve-workspace-files';
import { LoadedNxPlugin } from './internal-api';
import { LoadPluginError } from '../error-types';
import path = require('node:path/posix');
import { readTsConfig } from '../../plugins/js/utils/typescript';
import { loadResolvedNxPluginAsync } from './load-resolved-plugin';

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
      const localPluginPath = resolveLocalNxPlugin(pluginName, projects);
      if (localPluginPath) {
        const localPluginPackageJson = path.join(
          localPluginPath.path,
          'package.json'
        );
        if (!unregisterPluginTSTranspiler) {
          registerPluginTSTranspiler();
        }
        return {
          path: localPluginPackageJson,
          json: readJsonFile(localPluginPackageJson),
        };
      }
    }
    throw e;
  }
}

export function resolveLocalNxPlugin(
  importPath: string,
  projects: Record<string, ProjectConfiguration>,
  root = workspaceRoot
): { path: string; projectConfig: ProjectConfiguration } | null {
  return lookupLocalPlugin(importPath, projects, root);
}

export let unregisterPluginTSTranspiler: (() => void) | null = null;

/**
 * Register swc-node or ts-node if they are not currently registered
 * with some default settings which work well for Nx plugins.
 */
export function registerPluginTSTranspiler() {
  // Get the first tsconfig that matches the allowed set
  const tsConfigName = [
    join(workspaceRoot, 'tsconfig.base.json'),
    join(workspaceRoot, 'tsconfig.json'),
  ].find((x) => existsSync(x));

  if (!tsConfigName) {
    return;
  }

  const tsConfig: Partial<ts.ParsedCommandLine> = tsConfigName
    ? readTsConfig(tsConfigName)
    : {};
  const cleanupFns = [
    registerTsConfigPaths(tsConfigName),
    registerTranspiler(
      {
        experimentalDecorators: true,
        emitDecoratorMetadata: true,
        ...tsConfig.options,
      },
      tsConfig.raw
    ),
  ];
  unregisterPluginTSTranspiler = () => {
    cleanupFns.forEach((fn) => fn?.());
  };
}

function lookupLocalPlugin(
  importPath: string,
  projects: Record<string, ProjectConfiguration>,
  root = workspaceRoot
) {
  const projectConfig = findNxProjectForImportPath(importPath, projects, root);
  if (!projectConfig) {
    return null;
  }

  return { path: path.join(root, projectConfig.root), projectConfig };
}

function findNxProjectForImportPath(
  importPath: string,
  projects: Record<string, ProjectConfiguration>,
  root = workspaceRoot
): ProjectConfiguration | null {
  const tsConfigPaths: Record<string, string[]> = readTsConfigPaths(root);
  const possibleTsPaths =
    tsConfigPaths[importPath]?.map((p) =>
      normalizePath(path.relative(root, path.join(root, p)))
    ) ?? [];

  const projectRootMappings: ProjectRootMappings = new Map();
  if (possibleTsPaths.length) {
    const projectNameMap = new Map<string, ProjectConfiguration>();
    for (const projectRoot in projects) {
      const project = projects[projectRoot];
      projectRootMappings.set(project.root, project.name);
      projectNameMap.set(project.name, project);
    }
    for (const tsConfigPath of possibleTsPaths) {
      const nxProject = findProjectForPath(tsConfigPath, projectRootMappings);
      if (nxProject) {
        return projectNameMap.get(nxProject);
      }
    }
  }

  // try to resolve from the projects' package.json names
  const projectName = getNameFromPackageJson(importPath, root, projects);
  if (projectName) {
    return projects[projectName];
  }

  logger.verbose(
    'Unable to find local plugin',
    possibleTsPaths,
    projectRootMappings
  );
  throw new Error(
    'Unable to resolve local plugin with import path ' + importPath
  );
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

let packageJsonMap: Record<string, string>;
let seenProjects: Set<string>;

/**
 * Locate the project name from the package.json files in the provided projects.
 * Progressively build up a map of package names to project names to avoid
 * reading the same package.json multiple times and reading unnecessary ones.
 */
function getNameFromPackageJson(
  importPath: string,
  root: string = workspaceRoot,
  projects: Record<string, ProjectConfiguration>
): string | null {
  packageJsonMap ??= {};
  seenProjects ??= new Set();

  const resolveFromPackageJson = (projectName: string) => {
    try {
      const packageJson = readJsonFile(
        path.join(root, projects[projectName].root, 'package.json')
      );
      packageJsonMap[packageJson.name ?? projectName] = projectName;

      if (packageJsonMap[importPath]) {
        // we found the importPath, we progressively build up packageJsonMap
        // so we can return early
        return projectName;
      }
    } catch {}

    return null;
  };

  if (packageJsonMap[importPath]) {
    if (!!projects[packageJsonMap[importPath]]) {
      return packageJsonMap[importPath];
    } else {
      // the previously resolved project might have been resolved with the
      // project root as the name, so we need to resolve it again to get
      // the actual project name
      const projectName = Object.keys(projects).find(
        (p) => projects[p].root === packageJsonMap[importPath]
      );
      const resolvedProject = resolveFromPackageJson(projectName);
      if (resolvedProject) {
        return resolvedProject;
      }
    }
  }

  for (const projectName of Object.keys(projects)) {
    if (seenProjects.has(projectName)) {
      // we already parsed this project
      continue;
    }
    seenProjects.add(projectName);

    const resolvedProject = resolveFromPackageJson(projectName);
    if (resolvedProject) {
      return resolvedProject;
    }
  }

  return null;
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

export function getPluginPathAndName(
  moduleName: string,
  paths: string[],
  projects: Record<string, ProjectConfiguration>,
  root: string
) {
  let pluginPath: string;
  let shouldRegisterTSTranspiler = false;
  try {
    pluginPath = require.resolve(moduleName, {
      paths,
    });
    const extension = path.extname(pluginPath);
    shouldRegisterTSTranspiler = extension === '.ts';
  } catch (e) {
    if (e.code === 'MODULE_NOT_FOUND') {
      const plugin = resolveLocalNxPlugin(moduleName, projects, root);
      if (plugin) {
        shouldRegisterTSTranspiler = true;
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
    !['.ts', '.js'].some((x) => extname(moduleName) === x) && // Not trying to point to a ts or js file
    existsSync(packageJsonPath) // plugin has a package.json
      ? readJsonFile(packageJsonPath) // read name from package.json
      : { name: moduleName };
  return { pluginPath, name, shouldRegisterTSTranspiler };
}

let projectsWithoutInference: Record<string, ProjectConfiguration>;

export function loadNxPlugin(plugin: PluginConfiguration, root: string) {
  return [
    loadNxPluginAsync(plugin, getNxRequirePaths(root), root),
    () => {},
  ] as const;
}

export async function resolveNxPlugin(
  moduleName: string,
  root: string,
  paths: string[]
) {
  try {
    require.resolve(moduleName);
  } catch {
    // If a plugin cannot be resolved, we will need projects to resolve it
    projectsWithoutInference ??=
      await retrieveProjectConfigurationsWithoutPluginInference(root);
  }
  const { pluginPath, name, shouldRegisterTSTranspiler } = getPluginPathAndName(
    moduleName,
    paths,
    projectsWithoutInference,
    root
  );
  return { pluginPath, name, shouldRegisterTSTranspiler };
}

export async function loadNxPluginAsync(
  pluginConfiguration: PluginConfiguration,
  paths: string[],
  root: string
): Promise<LoadedNxPlugin> {
  const moduleName =
    typeof pluginConfiguration === 'string'
      ? pluginConfiguration
      : pluginConfiguration.plugin;
  try {
    const { pluginPath, name, shouldRegisterTSTranspiler } =
      await resolveNxPlugin(moduleName, root, paths);

    if (shouldRegisterTSTranspiler) {
      registerPluginTSTranspiler();
    }
    return loadResolvedNxPluginAsync(pluginConfiguration, pluginPath, name);
  } catch (e) {
    throw new LoadPluginError(moduleName, e);
  }
}
