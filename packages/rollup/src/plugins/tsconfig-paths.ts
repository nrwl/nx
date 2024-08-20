import { joinPathFragments, workspaceRoot } from '@nx/devkit';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import {
  type ConfigLoaderSuccessResult,
  createMatchPath,
  loadConfig,
  type MatchPath,
} from 'tsconfig-paths';
import type { Plugin } from 'rollup';

export interface NxRollupTsConfigPathsOptions {
  /**
   * The path to tsconfig file.
   */
  tsConfig: string;
  /**
   * export fields in package.json to use for resolving
   * @default [['exports', '.', 'import'], 'module', 'main']
   *
   * fallback resolution will use ['main', 'module']
   **/
  mainFields?: (string | string[])[];
  /**
   * extensions to check when resolving files when package.json resolution fails
   * @default ['.ts', '.tsx', '.js', '.jsx', '.json', '.mjs', '.cjs']
   **/
  extensions?: string[];
}

export function tsConfigPaths(options: NxRollupTsConfigPathsOptions) {
  let matchTsPathEsm: MatchPath;
  let matchTsPathFallback: MatchPath | undefined;
  let tsConfigPathsEsm: ConfigLoaderSuccessResult;
  let tsConfigPathsFallback: ConfigLoaderSuccessResult;

  options.extensions ??= [
    '.ts',
    '.tsx',
    '.js',
    '.jsx',
    '.json',
    '.mjs',
    '.cjs',
  ];
  options.mainFields ??= [['exports', '.', 'import'], 'module', 'main'];

  const parsed = loadConfig(options.tsConfig);

  if (parsed.resultType === 'failed') {
    throw new Error(`Failed loading tsconfig at ${options.tsConfig}`);
  }
  tsConfigPathsEsm = parsed;

  matchTsPathEsm = createMatchPath(
    parsed.absoluteBaseUrl,
    parsed.paths,
    options.mainFields
  );

  const rootLevelTsConfig = getTsConfig(
    join(workspaceRoot, 'tsconfig.base.json')
  );
  const rootLevelParsed = loadConfig(rootLevelTsConfig);
  if (rootLevelParsed.resultType === 'success') {
    tsConfigPathsFallback = rootLevelParsed;
    matchTsPathFallback = createMatchPath(
      rootLevelParsed.absoluteBaseUrl,
      rootLevelParsed.paths,
      ['main', 'module']
    );
  }
  return {
    name: 'nx-tsconfig-paths',
    enforce: 'pre',
    resolveId(importPath: string) {
      let resolvedFile: string;
      try {
        resolvedFile = matchTsPathEsm(importPath);
      } catch (e) {
        resolvedFile = matchTsPathFallback?.(importPath);
      }

      if (!resolvedFile) {
        if (tsConfigPathsEsm || tsConfigPathsFallback) {
          resolvedFile =
            loadFileFromPaths(tsConfigPathsEsm, importPath) ||
            loadFileFromPaths(tsConfigPathsFallback, importPath);
        } else {
        }
      }

      return resolvedFile ?? null;
    },
  } as Plugin;

  function getTsConfig(preferredTsConfigPath: string): string {
    return [
      resolve(preferredTsConfigPath),
      resolve(join(workspaceRoot, 'tsconfig.base.json')),
      resolve(join(workspaceRoot, 'tsconfig.json')),
    ].find((tsPath) => {
      if (existsSync(tsPath)) {
        return tsPath;
      }
    });
  }

  function loadFileFromPaths(
    tsconfig: ConfigLoaderSuccessResult,
    importPath: string
  ) {
    let resolvedFile: string;
    for (const alias in tsconfig.paths) {
      const paths = tsconfig.paths[alias];

      const normalizedImport = alias.replace(/\/\*$/, '');

      if (importPath.startsWith(normalizedImport)) {
        const joinedPath = joinPathFragments(
          tsconfig.absoluteBaseUrl,
          paths[0].replace(/\/\*$/, '')
        );

        resolvedFile = findFile(
          importPath.replace(normalizedImport, joinedPath)
        );
      }
    }

    return resolvedFile;
  }

  function findFile(path: string): string {
    for (const ext of options.extensions) {
      const resolvedPath = resolve(path + ext);
      if (existsSync(resolvedPath)) {
        return resolvedPath;
      }

      const resolvedIndexPath = resolve(path, `index${ext}`);
      if (existsSync(resolvedIndexPath)) {
        return resolvedIndexPath;
      }
    }
  }
}
