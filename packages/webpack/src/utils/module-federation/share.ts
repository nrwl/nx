import type {
  SharedLibraryConfig,
  SharedWorkspaceLibraryConfig,
  WorkspaceLibrary,
} from './models';
import { AdditionalSharedConfig, SharedFunction } from './models';
import { dirname, join, normalize } from 'path';
import { readRootPackageJson } from './package-json';
import { readTsPathMappings, getRootTsConfigPath } from './typescript';
import {
  collectPackageSecondaryEntryPoints,
  collectWorkspaceLibrarySecondaryEntryPoints,
} from './secondary-entry-points';
import {
  type ProjectGraph,
  workspaceRoot,
  logger,
  readJsonFile,
  joinPathFragments,
} from '@nx/devkit';
import { existsSync } from 'fs';
import type { PackageJson } from 'nx/src/utils/package-json';

/**
 * Build an object of functions to be used with the ModuleFederationPlugin to
 * share Nx Workspace Libraries between Hosts and Remotes.
 *
 * @param workspaceLibs - The Nx Workspace Libraries to share
 * @param tsConfigPath - The path to TS Config File that contains the Path Mappings for the Libraries
 */
export function shareWorkspaceLibraries(
  workspaceLibs: WorkspaceLibrary[],
  tsConfigPath = process.env.NX_TSCONFIG_PATH ?? getRootTsConfigPath()
): SharedWorkspaceLibraryConfig {
  if (!workspaceLibs) {
    return getEmptySharedLibrariesConfig();
  }

  const tsconfigPathAliases = readTsPathMappings(tsConfigPath);
  if (!Object.keys(tsconfigPathAliases).length) {
    return getEmptySharedLibrariesConfig();
  }

  // Nested projects must come first, sort them as such
  const sortedTsConfigPathAliases = {};
  Object.keys(tsconfigPathAliases)
    .sort((a, b) => {
      return b.split('/').length - a.split('/').length;
    })
    .forEach(
      (key) => (sortedTsConfigPathAliases[key] = tsconfigPathAliases[key])
    );

  const pathMappings: { name: string; path: string }[] = [];
  for (const [key, paths] of Object.entries(sortedTsConfigPathAliases)) {
    const library = workspaceLibs.find((lib) => lib.importKey === key);
    if (!library) {
      continue;
    }

    // This is for Angular Projects that use ng-package.json
    // It will do nothing for React Projects
    collectWorkspaceLibrarySecondaryEntryPoints(
      library,
      sortedTsConfigPathAliases
    ).forEach(({ name, path }) =>
      pathMappings.push({
        name,
        path,
      })
    );

    pathMappings.push({
      name: key,
      path: normalize(join(workspaceRoot, paths[0])),
    });
  }

  const webpack = require('webpack');

  return {
    getAliases: () =>
      pathMappings.reduce(
        (aliases, library) => ({
          ...aliases,
          // If the library path ends in a wildcard, remove it as webpack can't handle this in resolve.alias
          // e.g. path/to/my/lib/* -> path/to/my/lib
          [library.name]: library.path.replace(/\/\*$/, ''),
        }),
        {}
      ),
    getLibraries: (
      projectRoot: string,
      eager?: boolean
    ): Record<string, SharedLibraryConfig> => {
      let pkgJson: PackageJson = null;
      if (
        projectRoot &&
        existsSync(
          joinPathFragments(workspaceRoot, projectRoot, 'package.json')
        )
      ) {
        pkgJson = readJsonFile(
          joinPathFragments(workspaceRoot, projectRoot, 'package.json')
        );
      }
      return pathMappings.reduce((libraries, library) => {
        // Check to see if the library version is declared in the app's package.json
        let version = pkgJson?.dependencies?.[library.name];
        if (!version && workspaceLibs.length > 0) {
          const workspaceLib = workspaceLibs.find(
            (lib) => lib.importKey === library.name
          );

          const libPackageJsonPath = workspaceLib
            ? join(workspaceLib.root, 'package.json')
            : null;
          if (libPackageJsonPath && existsSync(libPackageJsonPath)) {
            pkgJson = readJsonFile(libPackageJsonPath);

            if (pkgJson) {
              version = pkgJson.version;
            }
          }
        }

        return {
          ...libraries,
          [library.name]: {
            ...(version
              ? {
                  requiredVersion: version,
                  singleton: true,
                }
              : { requiredVersion: false }),
            eager,
          },
        };
      }, {} as Record<string, SharedLibraryConfig>);
    },
    getReplacementPlugin: () =>
      new webpack.NormalModuleReplacementPlugin(/./, (req) => {
        if (!req.request.startsWith('.')) {
          return;
        }

        const from = req.context;
        const to = normalize(join(req.context, req.request));

        for (const library of pathMappings) {
          const libFolder = normalize(dirname(library.path));
          if (!from.startsWith(libFolder) && to.startsWith(libFolder)) {
            const newReq = library.name.endsWith('/*')
              ? /**
                 * req usually is in the form of "../../../path/to/file"
                 * library.path is usually in the form of "/Users/username/path/to/Workspace/path/to/library"
                 *
                 * When a wildcard is used in the TS path mappings, we want to get everything after the import to
                 * re-route the request correctly inline with the webpack resolve.alias
                 */
                join(
                  library.name,
                  req.request.split(
                    library.path.replace(workspaceRoot, '').replace('/*', '')
                  )[1]
                )
              : library.name;
            req.request = newReq;
          }
        }
      }),
  };
}

/**
 * Build the Module Federation Share Config for a specific package and the
 * specified version of that package.
 * @param pkgName - Name of the package to share
 * @param version - Version of the package to require by other apps in the Module Federation setup
 */
export function getNpmPackageSharedConfig(
  pkgName: string,
  version: string
): SharedLibraryConfig | undefined {
  if (!version) {
    logger.warn(
      `Could not find a version for "${pkgName}" in the root "package.json" ` +
        'when collecting shared packages for the Module Federation setup. ' +
        'The package will not be shared.'
    );

    return undefined;
  }

  return { singleton: true, strictVersion: true, requiredVersion: version };
}

/**
 * Create a dictionary of packages and their Module Federation Shared Config
 * from an array of package names.
 *
 * Lookup the versions of the packages from the root package.json file in the
 * workspace.
 * @param packages - Array of package names as strings
 */
export function sharePackages(
  packages: string[]
): Record<string, SharedLibraryConfig> {
  const pkgJson = readRootPackageJson();
  const allPackages: { name: string; version: string }[] = [];
  packages.forEach((pkg) => {
    const pkgVersion =
      pkgJson.dependencies?.[pkg] ?? pkgJson.devDependencies?.[pkg];
    allPackages.push({ name: pkg, version: pkgVersion });
    collectPackageSecondaryEntryPoints(pkg, pkgVersion, allPackages);
  });

  return allPackages.reduce((shared, pkg) => {
    const config = getNpmPackageSharedConfig(pkg.name, pkg.version);
    if (config) {
      shared[pkg.name] = config;
    }

    return shared;
  }, {} as Record<string, SharedLibraryConfig>);
}

/**
 * Apply a custom function provided by the user that will modify the Shared Config
 * of the dependencies for the Module Federation build.
 *
 * @param sharedConfig - The original Shared Config to be modified
 * @param sharedFn - The custom function to run
 */
export function applySharedFunction(
  sharedConfig: Record<string, SharedLibraryConfig>,
  sharedFn: SharedFunction | undefined
): void {
  if (!sharedFn) {
    return;
  }

  for (const [libraryName, library] of Object.entries(sharedConfig)) {
    const mappedDependency = sharedFn(libraryName, library);
    if (mappedDependency === false) {
      delete sharedConfig[libraryName];
      continue;
    } else if (!mappedDependency) {
      continue;
    }

    sharedConfig[libraryName] = mappedDependency;
  }
}

/**
 * Add additional dependencies to the shared package that may not have been
 * discovered by the project graph.
 *
 * This can be useful for applications that use a Dependency Injection system
 * that expects certain Singleton values to be present in the shared injection
 * hierarchy.
 *
 * @param sharedConfig - The original Shared Config
 * @param additionalShared - The additional dependencies to add
 * @param projectGraph - The Nx project graph
 */
export function applyAdditionalShared(
  sharedConfig: Record<string, SharedLibraryConfig>,
  additionalShared: AdditionalSharedConfig | undefined,
  projectGraph: ProjectGraph
): void {
  if (!additionalShared) {
    return;
  }

  for (const shared of additionalShared) {
    if (typeof shared === 'string') {
      addStringDependencyToSharedConfig(sharedConfig, shared, projectGraph);
    } else if (Array.isArray(shared)) {
      sharedConfig[shared[0]] = shared[1];
    } else if (typeof shared === 'object') {
      sharedConfig[shared.libraryName] = shared.sharedConfig;
    }
  }
}

function addStringDependencyToSharedConfig(
  sharedConfig: Record<string, SharedLibraryConfig>,
  dependency: string,
  projectGraph: ProjectGraph
): void {
  if (projectGraph.nodes[dependency]) {
    sharedConfig[dependency] = { requiredVersion: false };
  } else if (projectGraph.externalNodes?.[`npm:${dependency}`]) {
    const pkgJson = readRootPackageJson();
    const config = getNpmPackageSharedConfig(
      dependency,
      pkgJson.dependencies?.[dependency] ??
        pkgJson.devDependencies?.[dependency]
    );

    if (!config) {
      return;
    }

    sharedConfig[dependency] = config;
  } else {
    const pkgJsonPath = require.resolve(`${dependency}/package.json`);
    if (!pkgJsonPath) {
      throw new Error(
        `Could not find package ${dependency} when applying it as a shared package. Are you sure it has been installed?`
      );
    }
    const pkgJson = readJsonFile(pkgJsonPath);
    const config = getNpmPackageSharedConfig(dependency, pkgJson.version);
  }
}

function getEmptySharedLibrariesConfig() {
  const webpack = require('webpack');
  return {
    getAliases: () => ({}),
    getLibraries: () => ({}),
    getReplacementPlugin: () =>
      new webpack.NormalModuleReplacementPlugin(/./, () => {}),
  };
}
