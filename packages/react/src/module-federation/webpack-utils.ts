import { existsSync } from 'fs';
import { NormalModuleReplacementPlugin } from 'webpack';
import { logger, workspaceRoot } from '@nrwl/devkit';
import { dirname, join, normalize } from 'path';
import { ParsedCommandLine } from 'typescript';
import {
  getRootTsConfigPath,
  readTsConfig,
} from '@nrwl/workspace/src/utilities/typescript';
import { SharedLibraryConfig } from './models';
import { readRootPackageJson } from './package-json';

export function shareWorkspaceLibraries(
  libraries: string[],
  tsConfigPath = process.env.NX_TSCONFIG_PATH ?? getRootTsConfigPath()
) {
  if (!existsSync(tsConfigPath)) {
    throw new Error(
      `NX: TsConfig Path for workspace libraries does not exist! (${tsConfigPath})`
    );
  }

  const tsConfig: ParsedCommandLine = readTsConfig(tsConfigPath);
  const tsconfigPathAliases = tsConfig.options?.paths;

  if (!tsconfigPathAliases) {
    return {
      getAliases: () => [],
      getLibraries: () => ({}),
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
          if (!from.startsWith(libFolder) && to.startsWith(libFolder)) {
            req.request = library.name;
          }
        }
      }),
  };
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

  return packages.reduce((shared, pkg) => {
    const config = getNpmPackageSharedConfig(
      pkg,
      pkgJson.dependencies?.[pkg] ?? pkgJson.devDependencies?.[pkg]
    );
    if (config) {
      shared[pkg] = config;
    }

    return shared;
  }, {} as Record<string, SharedLibraryConfig>);
}
