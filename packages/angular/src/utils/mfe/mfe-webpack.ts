import { existsSync, lstatSync, readdirSync, readFileSync } from 'fs';
import { NormalModuleReplacementPlugin } from 'webpack';
import { joinPathFragments, workspaceRoot } from '@nrwl/devkit';
import { dirname, join, normalize } from 'path';
import { ParsedCommandLine } from 'typescript';
import {
  getRootTsConfigPath,
  readTsConfig,
} from '@nrwl/workspace/src/utilities/typescript';

export interface SharedLibraryConfig {
  singleton: boolean;
  strictVersion: boolean;
  requiredVersion: string;
  eager: boolean;
}

export function shareWorkspaceLibraries(
  libraries: string[],
  tsConfigPath = process.env.NX_TSCONFIG_PATH ?? getRootTsConfigPath()
) {
  if (!existsSync(tsConfigPath)) {
    throw new Error(
      `NX MFE: TsConfig Path for workspace libraries does not exist! (${tsConfigPath})`
    );
  }

  const tsConfig: ParsedCommandLine = readTsConfig(tsConfigPath);
  const tsconfigPathAliases = tsConfig.options?.paths;

  if (!tsconfigPathAliases) {
    return {
      getAliases: () => [],
      getLibraries: () => {},
      getReplacementPlugin: () =>
        new NormalModuleReplacementPlugin(/./, () => {}),
    };
  }

  const pathMappings: { name: string; path: string }[] = [];
  for (const [key, paths] of Object.entries(tsconfigPathAliases)) {
    if (libraries && libraries.includes(key)) {
      const pathToLib = normalize(join(workspaceRoot, paths[0]));
      pathMappings.push({
        name: key,
        path: pathToLib,
      });
    }
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
        {}
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
          if (!from.startsWith(libFolder) && to.startsWith(libFolder)) {
            req.request = library.name;
          }
        }
      }),
  };
}

function collectPackageSecondaries(pkgName: string, packages: string[]) {
  const pathToPackage = join(workspaceRoot, 'node_modules', pkgName);
  const directories = readdirSync(pathToPackage)
    .filter((file) => file !== 'node_modules')
    .map((file) => join(pathToPackage, file))
    .filter((file) => lstatSync(file).isDirectory());

  const recursivelyCheckSubDirectories = (
    directories: string[],
    secondaries: string[]
  ) => {
    for (const directory of directories) {
      if (existsSync(join(directory, 'package.json'))) {
        secondaries.push(directory);
      }

      const subDirs = readdirSync(directory)
        .filter((file) => file !== 'node_modules')
        .map((file) => join(directory, file))
        .filter((file) => lstatSync(file).isDirectory());
      recursivelyCheckSubDirectories(subDirs, secondaries);
    }
  };

  const secondaries = [];
  recursivelyCheckSubDirectories(directories, secondaries);

  for (const secondary of secondaries) {
    const pathToPkg = join(secondary, 'package.json');
    const libName = JSON.parse(readFileSync(pathToPkg, 'utf-8')).name;
    if (!libName) {
      continue;
    }
    packages.push(libName);
    collectPackageSecondaries(libName, packages);
  }
}

export function sharePackages(
  packages: string[]
): Record<string, SharedLibraryConfig> {
  const pkgJsonPath = joinPathFragments(workspaceRoot, 'package.json');
  if (!existsSync(pkgJsonPath)) {
    throw new Error(
      'NX MFE: Could not find root package.json to determine dependency versions.'
    );
  }

  const pkgJson = JSON.parse(readFileSync(pkgJsonPath, 'utf-8'));

  const allPackages = [...packages];
  packages.forEach((pkg) => collectPackageSecondaries(pkg, allPackages));

  return allPackages.reduce((shared, pkgName) => {
    const nameToUseForVersionLookup =
      pkgName.split('/').length > 2
        ? pkgName.split('/').slice(0, 2).join('/')
        : pkgName;

    return {
      ...shared,
      [pkgName]: {
        singleton: true,
        strictVersion: true,
        requiredVersion: pkgJson.dependencies[nameToUseForVersionLookup],
      },
    };
  }, {});
}
