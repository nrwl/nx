import { existsSync } from 'fs';
import { extname, join, relative } from 'path';
import { resolve as resolveExports } from 'resolve.exports';
import {
  loadTsFile,
  registerSourceGraphResolver,
  requireWithTsconfigFallback,
} from '../plugins/js/utils/register';
import { getWorkspacePackagesMetadata } from '../plugins/js/utils/packages';
import { getRootTsConfigResolveExportsConditions } from '../plugins/js/utils/typescript';
import {
  isWorkspaceLocalResolution,
  toRootSpelling,
  withBuiltEntryResolutionHint,
} from '../project-graph/plugins/built-entry-resolution-hint';
import { isSourceEntry } from '../project-graph/plugins/entry-provenance';
import {
  createProjectRootMappingsFromProjectConfigurations,
  findProjectForPath,
} from '../project-graph/utils/find-project-for-path';
import { readJsonFile } from '../utils/fileutils';
import {
  getMetadataFromPackageJson,
  PackageJsonProjectMetadata,
  type PackageJson,
} from '../utils/package-json';
import { normalizePath } from '../utils/path';
import { workspaceRoot } from '../utils/workspace-root';
import type { ProjectConfiguration } from './workspace-json-project-json';

/**
 * Thrown when the schema file of an executor or generator cannot be resolved.
 */
export class SchemaResolutionError extends Error {
  constructor(
    public readonly schemaPath: string,
    public readonly directory: string,
    options?: { cause?: unknown }
  ) {
    super(
      `Could not resolve schema "${schemaPath}" from "${directory}".`,
      options
    );
    this.name = 'SchemaResolutionError';
  }
}

/**
 * Thrown when the implementation module of an executor or generator cannot be
 * resolved.
 */
export class ImplementationResolutionError extends Error {
  constructor(
    public readonly implementationModulePath: string,
    public readonly directory: string,
    options?: { cause?: unknown }
  ) {
    super(
      `Could not resolve "${implementationModulePath}" from "${directory}".`,
      options
    );
    this.name = 'ImplementationResolutionError';
  }
}

/**
 * This function is used to get the implementation factory of an executor or generator.
 * @param implementation path to the implementation
 * @param directory path to the directory
 * @param entryPackageName the package the collection was read from after
 * following `extends` or builder aliases; its project classifies the entry
 * and names it in load errors
 * @returns a function that returns the implementation
 */
export function getImplementationFactory<T>(
  implementation: string,
  directory: string,
  packageName: string,
  projects: Record<string, ProjectConfiguration>,
  entryPackageName = packageName
): () => T {
  const [implementationModulePath, implementationExportName] =
    implementation.split('#');
  return () => {
    const { path: modulePath, isSource } = resolveImplementationWithSourceGraph(
      implementationModulePath,
      directory,
      packageName,
      projects,
      entryPackageName
    );
    // Route .ts entrypoints through loadTsFile so the native-strip ->
    // swc/ts-node fallback chain runs. Plain require() bypasses the matcher
    // set and bubbles errors like extensionless `./schema` imports (strict
    // ESM resolution failures) straight to the CLI. JS entrypoints use
    // requireWithTsconfigFallback so workspace-alias imports still resolve.
    let module: any;
    try {
      module = /\.[cm]?ts$/.test(modulePath)
        ? loadTsFile(modulePath)
        : requireWithTsconfigFallback(modulePath);
    } catch (e) {
      if (isSource) {
        throw e;
      }
      const metadata = getPackagesMetadata(projects);
      throw withBuiltEntryResolutionHint(
        e,
        {
          path: modulePath,
          projectRoot: metadata.packageToProjectMap[entryPackageName]?.root,
        },
        workspaceRoot,
        metadata.packageManagerWorkspacePackages
      );
    }
    return implementationExportName
      ? module[implementationExportName]
      : (module.default ?? module);
  };
}

/**
 * This function is used to resolve the implementation of an executor or generator.
 * @param implementationModulePath
 * @param directory
 * @returns path to the implementation
 */
export function resolveImplementation(
  implementationModulePath: string,
  directory: string,
  packageName: string,
  projects: Record<string, ProjectConfiguration>
): string {
  return resolveImplementationWithMetadata(
    implementationModulePath,
    directory,
    packageName,
    projects
  ).path;
}

export function resolveImplementationWithSourceGraph(
  implementationModulePath: string,
  directory: string,
  packageName: string,
  projects: Record<string, ProjectConfiguration>,
  entryPackageName = packageName
): { path: string; isSource: boolean } {
  const resolved = resolveImplementationWithMetadata(
    implementationModulePath,
    directory,
    packageName,
    projects,
    entryPackageName
  );
  if (resolved.isSource) {
    // Loaded entries have no unload lifecycle, so the per-entry resolver
    // stays for the process lifetime.
    registerSourceGraphResolver(
      resolved.path,
      workspaceRoot,
      getPackagesMetadata(projects).packageManagerWorkspacePackageNames
    );
  }
  return resolved;
}

function resolveImplementationWithMetadata(
  implementationModulePath: string,
  directory: string,
  packageName: string,
  projects: Record<string, ProjectConfiguration>,
  entryPackageName = packageName
): { path: string; isSource: boolean } {
  const validImplementations = ['', '.js', '.ts'].map(
    (x) => implementationModulePath + x
  );
  const entryProject = directory.includes('node_modules')
    ? null
    : getEntryProject(entryPackageName, directory, projects);

  if (!directory.includes('node_modules')) {
    // It might be a local plugin where the implementation path points to the
    // outputs which might not exist or can be stale. We prioritize finding
    // the implementation from the source over the outputs.
    for (const maybeImplementation of validImplementations) {
      const maybeImplementationFromSource = tryResolveFromSource(
        maybeImplementation,
        directory,
        packageName,
        projects,
        entryProject
      );
      if (maybeImplementationFromSource) {
        return maybeImplementationFromSource;
      }
    }
  }

  for (const maybeImplementation of validImplementations) {
    let resolvedPath = join(directory, maybeImplementation);
    if (!existsSync(resolvedPath)) {
      try {
        resolvedPath = require.resolve(maybeImplementation, {
          paths: [directory],
        });
      } catch {
        continue;
      }
    }
    return {
      path: resolvedPath,
      isSource:
        entryProject && isWorkspaceLocalResolution(resolvedPath, workspaceRoot)
          ? isSourceEntry(resolvedPath, false, entryProject, workspaceRoot)
          : isWorkspaceLocalTsImplementation(resolvedPath),
    };
  }

  throw new ImplementationResolutionError(implementationModulePath, directory);
}

function isWorkspaceLocalTsImplementation(modulePath: string): boolean {
  return (
    /\.(?:[cm]?ts|tsx)$/.test(extname(modulePath)) &&
    isWorkspaceLocalResolution(modulePath, workspaceRoot)
  );
}

export function resolveSchema(
  schemaPath: string,
  directory: string,
  packageName: string,
  projects: Record<string, ProjectConfiguration>,
  entryPackageName = packageName
): string {
  if (!directory.includes('node_modules')) {
    // It might be a local plugin where the schema path points to the outputs
    // which might not exist or can be stale. We prioritize finding the schema
    // from the source over the outputs.
    const schemaPathFromSource = tryResolveFromSource(
      schemaPath,
      directory,
      packageName,
      projects,
      getEntryProject(entryPackageName, directory, projects)
    );
    if (schemaPathFromSource) {
      return schemaPathFromSource.path;
    }
  }

  const maybeSchemaPath = join(directory, schemaPath);
  if (existsSync(maybeSchemaPath)) {
    return maybeSchemaPath;
  }

  try {
    return require.resolve(schemaPath, {
      paths: [directory],
    });
  } catch (e) {
    throw new SchemaResolutionError(schemaPath, directory, { cause: e });
  }
}

// A path-referenced collection has no package name; its directory locates it.
function getEntryProject(
  entryPackageName: string,
  directory: string,
  projects: Record<string, ProjectConfiguration>
): ProjectConfiguration | null {
  return (
    getPackagesMetadata(projects).packageToProjectMap[entryPackageName] ??
    getProjectForDirectory(directory, projects)
  );
}

// Keyed by the project snapshot: a daemon sees many.
const projectRootMappings = new WeakMap<
  Record<string, ProjectConfiguration>,
  Map<string, string>
>();
const packagesMetadata = new WeakMap<
  Record<string, ProjectConfiguration>,
  ReturnType<typeof getWorkspacePackagesMetadata<ProjectConfiguration>>
>();

function getPackagesMetadata(projects: Record<string, ProjectConfiguration>) {
  let metadata = packagesMetadata.get(projects);
  if (!metadata) {
    metadata = getWorkspacePackagesMetadata(projects);
    packagesMetadata.set(projects, metadata);
  }
  return metadata;
}

function getProjectForDirectory(
  directory: string,
  projects: Record<string, ProjectConfiguration>
): ProjectConfiguration | null {
  let mappings = projectRootMappings.get(projects);
  if (!mappings) {
    mappings = createProjectRootMappingsFromProjectConfigurations(projects);
    projectRootMappings.set(projects, mappings);
  }
  const projectName = findProjectForPath(
    relative(workspaceRoot, toRootSpelling(directory, workspaceRoot)),
    mappings
  );
  return projectName ? projects[projectName] : null;
}

/**
 * Reads the JS package metadata (package name and exports) for a project
 * directly from its `package.json`. Used as a fallback when a project's graph
 * metadata doesn't include the JS metadata.
 */
function readJsPackageMetadata(
  project: ProjectConfiguration
): PackageJsonProjectMetadata['js'] | null {
  const packageJsonPath = join(workspaceRoot, project.root, 'package.json');
  if (!existsSync(packageJsonPath)) {
    return null;
  }
  try {
    const packageJson = readJsonFile<PackageJson>(packageJsonPath);
    return (
      getMetadataFromPackageJson(
        packageJson,
        false
      ) as PackageJsonProjectMetadata
    ).js;
  } catch {
    return null;
  }
}

function tryResolveFromSource(
  path: string,
  directory: string,
  packageName: string,
  projects: Record<string, ProjectConfiguration>,
  entryProject: ProjectConfiguration | null
): { path: string; isSource: boolean } | null {
  let localProject =
    getPackagesMetadata(projects).packageToProjectMap[packageName];
  // The `packageName` might be a path to the collection rather than an actual
  // package name (e.g. when a generator/executor collection is referenced by
  // path). In that case, `directory` points inside the local project, so we
  // find the project that contains it.
  localProject ??= getProjectForDirectory(directory, projects);
  if (!localProject) {
    return null;
  }
  // The requested package's exports select the file; the declaring project
  // classifies it, since an alias or `extends` reads another package's files.
  const classifyingProject = entryProject ?? localProject;
  const js =
    (localProject.metadata as PackageJsonProjectMetadata)?.js ??
    readJsPackageMetadata(localProject);
  if (!js) {
    return null;
  }
  const name = js.packageName;
  const exports = js.packageExports;

  try {
    const fromExports = resolveExports({ name, exports }, path, {
      conditions: getRootTsConfigResolveExportsConditions(),
    });
    if (fromExports && fromExports.length) {
      let defaultMatches: string[] | void;
      try {
        defaultMatches = resolveExports({ name, exports }, path, {
          conditions: [],
        });
      } catch {}
      const defaultMatch = (defaultMatches || []).find((m) =>
        existsSync(join(directory, m))
      );
      for (const exportPath of fromExports) {
        const candidate = join(directory, exportPath);
        if (existsSync(candidate)) {
          return {
            path: candidate,
            isSource: isSourceEntry(
              candidate,
              defaultMatch !== exportPath,
              classifyingProject,
              workspaceRoot
            ),
          };
        }
      }
    }
  } catch {}

  /**
   * Fall back to try to "guess" the source by checking the path in some common directories:
   * - the root of the project
   * - the src directory
   * - the src/lib directory
   */
  const segments = normalizePath(path).replace(/^\.\//, '').split('/');
  for (let i = 1; i < segments.length; i++) {
    const possiblePaths = [
      join(directory, ...segments.slice(i)),
      join(directory, 'src', ...segments.slice(i)),
      join(directory, 'src', 'lib', ...segments.slice(i)),
    ];

    for (const possiblePath of possiblePaths) {
      if (existsSync(possiblePath)) {
        return {
          path: possiblePath,
          isSource: isSourceEntry(
            possiblePath,
            false,
            classifyingProject,
            workspaceRoot
          ),
        };
      }
    }
  }

  return null;
}
