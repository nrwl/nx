import { readTsConfig } from '@nrwl/workspace';
import { existsSync } from 'fs';
import { NormalModuleReplacementPlugin } from 'webpack';
import { appRootPath as rootPath } from '@nrwl/tao/src/utils/app-root';
import { normalizePath, joinPathFragments } from '@nrwl/devkit';
import { dirname } from 'path';
import { ParsedCommandLine } from 'typescript';

export function shareWorkspaceLibraries(
  libraries: string[],
  tsConfigPath = process.env.NX_TSCONFIG_PATH
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
      getLibraries: () => [],
      getReplacementPlugin: () =>
        new NormalModuleReplacementPlugin(/./, () => {}),
    };
  }

  const pathMappings: { name: string; path: string }[] = [];
  for (const [key, paths] of Object.entries(tsconfigPathAliases)) {
    if (libraries && libraries.includes(key)) {
      const pathToLib = normalizePath(joinPathFragments(rootPath, paths[0]));
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
    getLibraries: (eager?: boolean) =>
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
        const to = normalizePath(joinPathFragments(req.context, req.request));

        for (const library of pathMappings) {
          const libFolder = normalizePath(dirname(library.path));
          if (!from.startsWith(libFolder) && to.startsWith(libFolder)) {
            req.request = library.name;
          }
        }
      }),
  };
}
