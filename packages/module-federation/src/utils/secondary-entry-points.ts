import type { WorkspaceLibrary } from './models';
import { WorkspaceLibrarySecondaryEntryPoint } from './models';
import { dirname, join, relative } from 'path';
import { existsSync, lstatSync, readdirSync } from 'fs';
import { readJsonFile, joinPathFragments, workspaceRoot } from '@nx/devkit';
import { PackageJson, readModulePackageJson } from 'nx/src/utils/package-json';

export function collectWorkspaceLibrarySecondaryEntryPoints(
  library: WorkspaceLibrary,
  tsconfigPathAliases: Record<string, string[]>
): WorkspaceLibrarySecondaryEntryPoint[] {
  const libraryRoot = join(workspaceRoot, library.root);
  const needsSecondaryEntryPointsCollected = existsSync(
    join(libraryRoot, 'ng-package.json')
  );

  const secondaryEntryPoints: WorkspaceLibrarySecondaryEntryPoint[] = [];
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

export function getNonNodeModulesSubDirs(directory: string): string[] {
  return readdirSync(directory)
    .filter((file) => file !== 'node_modules')
    .map((file) => join(directory, file))
    .filter((file) => lstatSync(file).isDirectory());
}

export function recursivelyCollectSecondaryEntryPointsFromDirectory(
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

function collectPackagesFromExports(
  pkgName: string,
  pkgVersion: string,
  exports: any | undefined,
  collectedPackages: {
    name: string;
    version: string;
  }[]
): void {
  for (const [relativeEntryPoint, exportOptions] of Object.entries(exports)) {
    const defaultExportOptions =
      typeof exportOptions?.['default'] === 'string'
        ? exportOptions?.['default']
        : exportOptions?.['default']?.['default'];

    if (defaultExportOptions?.search(/\.(js|mjs|cjs)$/)) {
      let entryPointName = joinPathFragments(pkgName, relativeEntryPoint);
      if (entryPointName.endsWith('.json')) {
        entryPointName = dirname(entryPointName);
      }
      if (entryPointName === '.') {
        continue;
      }
      if (collectedPackages.find((p) => p.name === entryPointName)) {
        continue;
      }

      collectedPackages.push({ name: entryPointName, version: pkgVersion });
    }
  }
}

export function collectPackageSecondaryEntryPoints(
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
  if (exports) {
    collectPackagesFromExports(pkgName, pkgVersion, exports, collectedPackages);
  }
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
