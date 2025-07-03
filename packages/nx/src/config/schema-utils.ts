import { existsSync } from 'fs';
import { extname, join } from 'path';
import { resolve as resolveExports } from 'resolve.exports';
import { getWorkspacePackagesMetadata } from '../plugins/js/utils/packages';
import { registerPluginTSTranspiler } from '../project-graph/plugins';
import { normalizePath } from '../utils/path';
import type { ProjectConfiguration } from './workspace-json-project-json';

/**
 * This function is used to get the implementation factory of an executor or generator.
 * @param implementation path to the implementation
 * @param directory path to the directory
 * @returns a function that returns the implementation
 */
export function getImplementationFactory<T>(
  implementation: string,
  directory: string,
  packageName: string,
  projects: Record<string, ProjectConfiguration>
): () => T {
  const [implementationModulePath, implementationExportName] =
    implementation.split('#');
  return () => {
    console.log('resolving implementation');
    const modulePath = resolveImplementation(
      implementationModulePath,
      directory,
      packageName,
      projects
    );
    if (extname(modulePath) === '.ts') {
      registerPluginTSTranspiler();
    }
    const module = require(modulePath);
    return implementationExportName
      ? module[implementationExportName]
      : module.default ?? module;
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
  const validImplementations = ['', '.js', '.ts'].map(
    (x) => implementationModulePath + x
  );

  if (!directory.includes('node_modules')) {
    // It might be a local plugin where the implementation path points to the
    // outputs which might not exist or can be stale. We prioritize finding
    // the implementation from the source over the outputs.
    for (const maybeImplementation of validImplementations) {
      const maybeImplementationFromSource = tryResolveFromSource(
        maybeImplementation,
        directory,
        packageName,
        projects
      );
      if (maybeImplementationFromSource) {
        return maybeImplementationFromSource;
      }
    }
  }

  for (const maybeImplementation of validImplementations) {
    const maybeImplementationPath = join(directory, maybeImplementation);
    if (existsSync(maybeImplementationPath)) {
      return maybeImplementationPath;
    }

    try {
      return require.resolve(maybeImplementation, {
        paths: [directory],
      });
    } catch {}
  }

  throw new Error(
    `Could not resolve "${implementationModulePath}" from "${directory}".`
  );
}

export function resolveSchema(
  schemaPath: string,
  directory: string,
  packageName: string,
  projects: Record<string, ProjectConfiguration>
): string {
  if (!directory.includes('node_modules')) {
    // It might be a local plugin where the schema path points to the outputs
    // which might not exist or can be stale. We prioritize finding the schema
    // from the source over the outputs.
    const schemaPathFromSource = tryResolveFromSource(
      schemaPath,
      directory,
      packageName,
      projects
    );
    if (schemaPathFromSource) {
      return schemaPathFromSource;
    }
  }

  const maybeSchemaPath = join(directory, schemaPath);
  if (existsSync(maybeSchemaPath)) {
    return maybeSchemaPath;
  }

  return require.resolve(schemaPath, {
    paths: [directory],
  });
}

let packageToProjectMap: Record<string, ProjectConfiguration>;
function tryResolveFromSource(
  path: string,
  directory: string,
  packageName: string,
  projects: Record<string, ProjectConfiguration>
): string | null {
  packageToProjectMap ??=
    getWorkspacePackagesMetadata(projects).packageToProjectMap;
  const localProject = packageToProjectMap[packageName];
  if (!localProject) {
    // it doesn't match any of the package names from the local projects
    return null;
  }

  try {
    const fromExports = resolveExports(
      {
        name: localProject.metadata!.js!.packageName,
        exports: localProject.metadata!.js!.packageExports,
      },
      path,
      { conditions: ['development'] }
    );
    if (fromExports && fromExports.length) {
      for (const exportPath of fromExports) {
        if (existsSync(join(directory, exportPath))) {
          return join(directory, exportPath);
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
        return possiblePath;
      }
    }
  }

  return null;
}
