import {
  joinPathFragments,
  logger,
  readJsonFile,
  workspaceRoot,
} from '@nrwl/devkit';
import { getRootTsConfigPath } from '@nrwl/workspace/src/utilities/typescript';
import { existsSync, lstatSync, readdirSync } from 'fs';
import { PackageJson, readModulePackageJson } from 'nx/src/utils/package-json';
import { dirname, join, normalize, relative } from 'path';
import { NormalModuleReplacementPlugin } from 'webpack';
import { readTsPathMappings } from './typescript';
import { readRootPackageJson, WorkspaceLibrary } from './utils';

export interface SharedLibraryConfig {
  singleton?: boolean;
  strictVersion?: boolean;
  requiredVersion?: false | string;
  eager?: boolean;
}

function collectWorkspaceLibrarySecondaryEntryPoints(
  library: WorkspaceLibrary,
  tsconfigPathAliases: Record<string, string[]>
) {
  const libraryRoot = join(workspaceRoot, library.root);
  const needsSecondaryEntryPointsCollected = existsSync(
    join(libraryRoot, 'ng-package.json')
  );

  const secondaryEntryPoints = [];
  if (needsSecondaryEntryPointsCollected) {
    const tsConfigAliasesForLibWithSecondaryEntryPoints = Object.entries(
      tsconfigPathAliases
    ).reduce((acc, [tsKey, tsPaths]) => {
      if (!tsKey.startsWith(library.importKey)) {
        return { ...acc };
      }

      if (tsPaths.some((path) => path.startsWith(`${library.root}/`))) {
        acc = { ...acc, [tsKey]: tsPaths };
      }

      return acc;
    }, {});

    for (const [alias] of Object.entries(
      tsConfigAliasesForLibWithSecondaryEntryPoints
    )) {
      const pathToLib = dirname(
        join(workspaceRoot, tsconfigPathAliases[alias][0])
      );
      let searchDir = pathToLib;
      while (searchDir !== libraryRoot) {
        if (existsSync(join(searchDir, 'ng-package.json'))) {
          secondaryEntryPoints.push({ name: alias, path: pathToLib });
          break;
        }
        searchDir = dirname(searchDir);
      }
    }
  }

  return secondaryEntryPoints;
}

export function shareWorkspaceLibraries(
  libraries: WorkspaceLibrary[],
  tsConfigPath = process.env.NX_TSCONFIG_PATH ?? getRootTsConfigPath()
) {
  if (!libraries) {
    return getEmptySharedLibrariesConfig();
  }

  const tsconfigPathAliases = readTsPathMappings(tsConfigPath);
  if (!Object.keys(tsconfigPathAliases).length) {
    return getEmptySharedLibrariesConfig();
  }

  const pathMappings: { name: string; path: string }[] = [];
  for (const [key, paths] of Object.entries(tsconfigPathAliases)) {
    const library = libraries.find((lib) => lib.importKey === key);
    if (!library) {
      continue;
    }

    collectWorkspaceLibrarySecondaryEntryPoints(
      library,
      tsconfigPathAliases
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

  return {
    getAliases: () =>
      pathMappings.reduce(
        (aliases, library) => ({ ...aliases, [library.name]: library.path }),
        {}
      ),
    getLibraries: (eager?: boolean): Record<string, SharedLibraryConfig> =>
      pathMappings.reduce(
        (libraries, library) => ({
          ...libraries,
          [library.name]: { requiredVersion: false, eager },
        }),
        {} as Record<string, SharedLibraryConfig>
      ),
    getReplacementPlugin: () =>
      new NormalModuleReplacementPlugin(/./, (req) => {
        if (!req.request.startsWith('.')) {
          return;
        }

        const from = req.context;
        const to = normalize(join(req.context, req.request));

        for (const library of pathMappings) {
          const libFolder = normalize(dirname(library.path));
          if (
            !from.startsWith(libFolder) &&
            to.startsWith(libFolder) &&
            !library.name.endsWith('/*')
          ) {
            req.request = library.name;
          }
        }
      }),
  };
}

function getEmptySharedLibrariesConfig() {
  return {
    getAliases: () => ({}),
    getLibraries: () => ({}),
    getReplacementPlugin: () =>
      new NormalModuleReplacementPlugin(/./, () => {}),
  };
}

function getNonNodeModulesSubDirs(directory: string): string[] {
  return readdirSync(directory)
    .filter((file) => file !== 'node_modules')
    .map((file) => join(directory, file))
    .filter((file) => lstatSync(file).isDirectory());
}

function recursivelyCollectSecondaryEntryPointsFromDirectory(
  pkgName: string,
  pkgVersion: string,
  pkgRoot: string,
  mainEntryPointExports: any | undefined,
  directories: string[],
  collectedPackages: { name: string; version: string }[]
): void {
  for (const directory of directories) {
    const packageJsonPath = join(directory, 'package.json');
    const relativeEntryPointPath = relative(pkgRoot, directory);
    const entryPointName = joinPathFragments(pkgName, relativeEntryPointPath);
    if (existsSync(packageJsonPath)) {
      try {
        // require the secondary entry point to try to rule out sample code
        require.resolve(entryPointName, { paths: [workspaceRoot] });
        const { name } = readJsonFile(packageJsonPath);
        // further check to make sure what we were able to require is the
        // same as the package name
        if (name === entryPointName) {
          collectedPackages.push({ name, version: pkgVersion });
        }
      } catch {}
    } else if (mainEntryPointExports) {
      // if the package.json doesn't exist, check if the directory is
      // exported by the main entry point
      const entryPointExportKey = `./${relativeEntryPointPath}`;
      const entryPointInfo = mainEntryPointExports[entryPointExportKey];
      if (entryPointInfo) {
        collectedPackages.push({
          name: entryPointName,
          version: pkgVersion,
        });
      }
    }

    const subDirs = getNonNodeModulesSubDirs(directory);
    recursivelyCollectSecondaryEntryPointsFromDirectory(
      pkgName,
      pkgVersion,
      pkgRoot,
      mainEntryPointExports,
      subDirs,
      collectedPackages
    );
  }
}

function collectPackageSecondaryEntryPoints(
  pkgName: string,
  pkgVersion: string,
  collectedPackages: { name: string; version: string }[]
): void {
  let pathToPackage: string;
  let packageJsonPath: string;
  let packageJson: PackageJson;
  try {
    ({ path: packageJsonPath, packageJson } = readModulePackageJson(pkgName));
    pathToPackage = dirname(packageJsonPath);
  } catch {
    // the package.json might not resolve if the package has the "exports"
    // entry and is not exporting the package.json file, fall back to trying
    // to find it from the top-level node_modules
    pathToPackage = join(workspaceRoot, 'node_modules', pkgName);
    packageJsonPath = join(pathToPackage, 'package.json');
    if (!existsSync(packageJsonPath)) {
      // might not exist if it's nested in another package, just return here
      return;
    }
    packageJson = readJsonFile(packageJsonPath);
  }

  const { exports } = packageJson;
  const subDirs = getNonNodeModulesSubDirs(pathToPackage);
  recursivelyCollectSecondaryEntryPointsFromDirectory(
    pkgName,
    pkgVersion,
    pathToPackage,
    exports,
    subDirs,
    collectedPackages
  );
}

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
