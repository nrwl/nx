import * as path from 'node:path';
import { existsSync } from 'node:fs';

import {
  getWorkspacePackagesMetadata,
  matchImportToWildcardEntryPointsToProjectMap,
} from '../../plugins/js/utils/packages';
import { readJsonFile } from '../../utils/fileutils';
import { logger } from '../../utils/logger';
import { normalizePath } from '../../utils/path';
import { workspaceRoot } from '../../utils/workspace-root';
import {
  findProjectForPath,
  ProjectRootMappings,
} from '../utils/find-project-for-path';
import { retrieveProjectConfigurationsWithoutPluginInference } from '../utils/retrieve-workspace-files';

import type { ProjectConfiguration } from '../../config/workspace-json-project-json';

let projectsWithoutInference: Record<string, ProjectConfiguration>;

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

export function resolveLocalNxPlugin(
  importPath: string,
  projects: Record<string, ProjectConfiguration>,
  root = workspaceRoot
): { path: string; projectConfig: ProjectConfiguration } | null {
  return lookupLocalPlugin(importPath, projects, root);
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
    !['.ts', '.js'].some((x) => path.extname(moduleName) === x) && // Not trying to point to a ts or js file
    existsSync(packageJsonPath) // plugin has a package.json
      ? readJsonFile(packageJsonPath) // read name from package.json
      : { name: moduleName };
  return { pluginPath, name, shouldRegisterTSTranspiler };
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

let packageEntryPointsToProjectMap: Record<string, ProjectConfiguration>;
let wildcardEntryPointsToProjectMap: Record<string, ProjectConfiguration>;
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

  if (!packageEntryPointsToProjectMap && !wildcardEntryPointsToProjectMap) {
    ({
      entryPointsToProjectMap: packageEntryPointsToProjectMap,
      wildcardEntryPointsToProjectMap,
    } = getWorkspacePackagesMetadata(projects));
  }
  if (packageEntryPointsToProjectMap[importPath]) {
    return packageEntryPointsToProjectMap[importPath];
  }

  const project = matchImportToWildcardEntryPointsToProjectMap(
    wildcardEntryPointsToProjectMap,
    importPath
  );
  if (project) {
    return project;
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
