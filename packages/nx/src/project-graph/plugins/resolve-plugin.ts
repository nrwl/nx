import * as path from 'node:path';
import { existsSync } from 'node:fs';
import { resolve as resolveExports } from 'resolve.exports';

import {
  getWorkspacePackagesMetadata,
  matchImportToWildcardEntryPointsToProjectMap,
} from '../../plugins/js/utils/packages';
import { getRootTsConfigResolveExportsConditions } from '../../plugins/js/utils/typescript';
import { readJsonFile } from '../../utils/fileutils';
import { logger } from '../../utils/logger';
import { normalizePath } from '../../utils/path';
import { workspaceRoot } from '../../utils/workspace-root';
import {
  findProjectForPath,
  ProjectRootMappings,
} from '../utils/find-project-for-path';
import {
  clearProjectsWithoutPluginInferenceCache,
  retrieveProjectConfigurationsWithoutPluginInference,
} from '../utils/retrieve-workspace-files';

import type { ProjectConfiguration } from '../../config/workspace-json-project-json';

type LocalPluginMatch = {
  path: string;
  projectConfig: ProjectConfiguration;
  // Set only when a tsconfig `paths` entry maps the import to an existing
  // file with an extension. Directory and extensionless mappings are left
  // for the downstream `main`/exports-condition flow to resolve, since they
  // require full module resolution to load.
  resolvedFile?: string;
};

const TS_SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.cts', '.mts']);

let projectsWithoutInference: Record<string, ProjectConfiguration>;
let projectsWithoutInferencePromise: Promise<
  typeof projectsWithoutInference
> | null = null;

export async function resolveNxPlugin(
  moduleName: string,
  root: string,
  paths: string[]
) {
  // Default plugins (see `getDefaultPlugins` in `get-plugins.ts`) are passed
  // as absolute file paths to compiled bundles inside `nx` itself; they are
  // never workspace-local. Skip the project load entirely for them to avoid
  // recursing through `retrieveProjectConfigurationsWithoutPluginInference`,
  // which itself triggers default-plugin loading.
  if (!path.isAbsolute(moduleName)) {
    let resolvedFromNode: string | undefined;
    try {
      resolvedFromNode = require.resolve(moduleName, { paths });
    } catch {}

    // Load projects if Node couldn't resolve (so the local fallback can run)
    // OR if Node resolved to a workspace-internal path (a symlinked workspace
    // package whose source-first lookup should win over the symlinked dist).
    if (
      !resolvedFromNode ||
      isWorkspaceLocalResolution(resolvedFromNode, root)
    ) {
      projectsWithoutInferencePromise ??=
        retrieveProjectConfigurationsWithoutPluginInference(root);
      projectsWithoutInference ??= await projectsWithoutInferencePromise;
    }
  }

  const { pluginPath, name, shouldRegisterTSTranspiler } = getPluginPathAndName(
    moduleName,
    paths,
    projectsWithoutInference,
    root
  );
  return { pluginPath, name, shouldRegisterTSTranspiler };
}

/**
 * Distinguishes a symlinked workspace package (where `require.resolve`
 * follows the package-manager symlink into the workspace source tree) from
 * a truly-installed dependency under `node_modules/`. The former needs the
 * source-first lookup to bypass the dist that Node would otherwise return.
 */
function isWorkspaceLocalResolution(
  resolvedPath: string,
  root: string
): boolean {
  const normalizedRoot = path.normalize(root);
  const normalizedPath = path.normalize(resolvedPath);
  return (
    normalizedPath.startsWith(normalizedRoot + path.sep) &&
    !normalizedPath.includes(path.sep + 'node_modules' + path.sep)
  );
}

function isPackageResolutionError(e: unknown): boolean {
  const code = (e as { code?: string }).code;
  return (
    code === 'MODULE_NOT_FOUND' || code === 'ERR_PACKAGE_PATH_NOT_EXPORTED'
  );
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
): LocalPluginMatch | null {
  return lookupLocalPlugin(importPath, projects, root);
}

export function getPluginPathAndName(
  moduleName: string,
  paths: string[],
  projects: Record<string, ProjectConfiguration>,
  root: string
) {
  let pluginPath: string | undefined;

  // Resolve local workspace plugins from source first so the workspace's
  // `customConditions`/`development` exports condition wins over the built
  // `dist` artifact that Node's resolver would otherwise pick up via the
  // `default` condition (Node ignores TypeScript custom conditions). Skipped
  // when `projects` weren't loaded — the caller already determined that the
  // import isn't a workspace package.
  const localPlugin = projects
    ? resolveLocalNxPlugin(moduleName, projects, root)
    : null;
  if (localPlugin) {
    pluginPath = tryResolveLocalPluginFromSource(moduleName, localPlugin, root);
    if (!pluginPath && getSubpathOfLocalPackage(moduleName, localPlugin)) {
      throwUnresolvableLocalPluginError(moduleName, localPlugin, root);
    }
  }

  if (!pluginPath) {
    try {
      pluginPath = require.resolve(moduleName, { paths });
    } catch (e) {
      if (localPlugin && isPackageResolutionError(e)) {
        throwUnresolvableLocalPluginError(moduleName, localPlugin, root);
      }
      if (e.code !== 'MODULE_NOT_FOUND') {
        throw e;
      }
      if (localPlugin) {
        throwUnresolvableLocalPluginError(moduleName, localPlugin, root);
      }
      logger.error(`Plugin listed in \`nx.json\` not found: ${moduleName}`);
      throw e;
    }
  }

  const ext = path.extname(pluginPath);
  // Directory paths fall through to Node's `package.json` `main` resolution
  // which may land on a TS file; only opt out of TS transpiler registration
  // when the resolved path is unambiguously JS.
  const shouldRegisterTSTranspiler =
    ext === '' || TS_SOURCE_EXTENSIONS.has(ext);

  const packageJsonPath = path.join(pluginPath, 'package.json');
  const { name } =
    !['.ts', '.js'].some((x) => path.extname(moduleName) === x) && // Not trying to point to a ts or js file
    existsSync(packageJsonPath) // plugin has a package.json
      ? readJsonFile(packageJsonPath) // read name from package.json
      : { name: moduleName };
  return { pluginPath, name, shouldRegisterTSTranspiler };
}

function getSubpathOfLocalPackage(
  moduleName: string,
  plugin: LocalPluginMatch
): string | null {
  const packageName = plugin.projectConfig.metadata?.js?.packageName;
  if (!packageName || !moduleName.startsWith(packageName + '/')) {
    return null;
  }
  return '.' + moduleName.slice(packageName.length);
}

function tryResolveLocalPluginFromSource(
  moduleName: string,
  plugin: LocalPluginMatch,
  root: string
): string | null {
  if (plugin.resolvedFile) {
    return plugin.resolvedFile;
  }

  const subpath = getSubpathOfLocalPackage(moduleName, plugin);
  if (subpath) {
    return resolveSubpathFromExports(
      plugin.projectConfig,
      plugin.path,
      subpath,
      root
    );
  }

  const main = readPluginMainFromProjectConfiguration(plugin.projectConfig);
  return main ? path.join(root, main) : null;
}

function throwUnresolvableLocalPluginError(
  moduleName: string,
  plugin: LocalPluginMatch,
  root: string
): never {
  const subpath = getSubpathOfLocalPackage(moduleName, plugin);
  const packageName = plugin.projectConfig.metadata?.js?.packageName;
  if (subpath) {
    throw new Error(
      `Unable to resolve local plugin "${moduleName}". The import targets ` +
        `the subpath "${subpath}" of the local package "${packageName}", but ` +
        `the package's "exports" map has no resolvable entry for "${subpath}", ` +
        `or none of the matched paths exist on disk. Check the "exports" field ` +
        `in "${path.relative(root, path.join(plugin.path, 'package.json'))}" ` +
        `and ensure the source file referenced by "${subpath}" exists.`
    );
  }

  throw new Error(
    `Unable to resolve local plugin "${moduleName}". The local package ` +
      `"${packageName ?? moduleName}" does not declare a build target with ` +
      `a "main" source path, and Node could not resolve it either.`
  );
}

function resolveSubpathFromExports(
  projectConfig: ProjectConfiguration,
  projectPath: string,
  subpath: string,
  root: string
): string | null {
  const packageExports = projectConfig.metadata?.js?.packageExports;
  if (!packageExports) {
    return null;
  }

  const pkg = {
    name: projectConfig.metadata!.js!.packageName,
    exports: packageExports,
  };

  try {
    const matches = resolveExports(pkg, subpath, {
      conditions: getRootTsConfigResolveExportsConditions(root),
    });
    if (!matches || !matches.length) {
      return null;
    }

    for (const match of matches) {
      const candidate = path.join(projectPath, match);
      if (existsSync(candidate)) {
        return candidate;
      }
    }
  } catch (e) {
    logger.verbose(
      `Failed to resolve subpath "${subpath}" of local plugin via package.json exports`,
      e
    );
  }

  return null;
}

function lookupLocalPlugin(
  importPath: string,
  projects: Record<string, ProjectConfiguration>,
  root = workspaceRoot
): LocalPluginMatch | null {
  const match = findNxProjectForImportPath(importPath, projects, root);
  if (!match) {
    return null;
  }

  let resolvedFile: string | undefined;
  if (match.tsPathFile) {
    const candidate = path.join(root, match.tsPathFile);
    if (path.extname(candidate) && existsSync(candidate)) {
      resolvedFile = candidate;
    }
  }

  return {
    path: path.join(root, match.projectConfig.root),
    projectConfig: match.projectConfig,
    resolvedFile,
  };
}

let packageEntryPointsToProjectMap: Record<string, ProjectConfiguration>;
let wildcardEntryPointsToProjectMap: Record<string, ProjectConfiguration>;
function findNxProjectForImportPath(
  importPath: string,
  projects: Record<string, ProjectConfiguration>,
  root = workspaceRoot
): { projectConfig: ProjectConfiguration; tsPathFile?: string } | null {
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
        return {
          projectConfig: projectNameMap.get(nxProject)!,
          tsPathFile: tsConfigPath,
        };
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
    return { projectConfig: packageEntryPointsToProjectMap[importPath] };
  }

  const project = matchImportToWildcardEntryPointsToProjectMap(
    wildcardEntryPointsToProjectMap,
    importPath
  );
  if (project) {
    return { projectConfig: project };
  }

  logger.verbose(
    'Unable to find local plugin',
    possibleTsPaths,
    projectRootMappings
  );
  return null;
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

/**
 * Drops the cached workspace-layout snapshot local-plugin resolution relies on
 * (project configs, tsconfig paths, package entry points). Kept for the life
 * of the process, it goes stale when a new local plugin is added — the plugin
 * then resolves to the workspace root (a directory) and fails to import.
 */
export function resetResolvePluginCache(): void {
  projectsWithoutInference = undefined;
  projectsWithoutInferencePromise = null;
  packageEntryPointsToProjectMap = undefined;
  wildcardEntryPointsToProjectMap = undefined;
  tsconfigPaths = undefined;
  clearProjectsWithoutPluginInferenceCache();
}
