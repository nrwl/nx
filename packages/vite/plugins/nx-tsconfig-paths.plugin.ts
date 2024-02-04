import { joinPathFragments, stripIndents, workspaceRoot } from '@nx/devkit';
import { existsSync } from 'node:fs';
import { relative, join, resolve } from 'node:path';
import {
  loadConfig,
  createMatchPath,
  MatchPath,
  ConfigLoaderSuccessResult,
} from 'tsconfig-paths';

export interface nxViteTsPathsOptions {
  /**
   * Enable debug logging
   * @default false
   **/
  debug?: boolean;
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

export function nxViteTsPaths(options: nxViteTsPathsOptions = {}) {
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

  return {
    name: 'nx-vite-ts-paths',
    configResolved(config: any) {
      const projectRoot = config.root;
      const projectRootFromWorkspaceRoot = relative(workspaceRoot, projectRoot);

      const foundTsConfigPath = getTsConfig(
        join(
          workspaceRoot,
          'tmp',
          projectRootFromWorkspaceRoot,
          'tsconfig.generated.json'
        )
      );
      if (!foundTsConfigPath) {
        throw new Error(stripIndents`Unable to find a tsconfig in the workspace! 
There should at least be a tsconfig.base.json or tsconfig.json in the root of the workspace ${workspaceRoot}`);
      }
      const parsed = loadConfig(foundTsConfigPath);

      logIt('first parsed tsconfig: ', parsed);
      if (parsed.resultType === 'failed') {
        throw new Error(`Failed loading tsonfig at ${foundTsConfigPath}`);
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
      logIt('fallback parsed tsconfig: ', rootLevelParsed);
      if (rootLevelParsed.resultType === 'success') {
        tsConfigPathsFallback = rootLevelParsed;
        matchTsPathFallback = createMatchPath(
          rootLevelParsed.absoluteBaseUrl,
          rootLevelParsed.paths,
          ['main', 'module']
        );
      }
    },
    resolveId(importPath: string) {
      let resolvedFile: string;
      try {
        resolvedFile = matchTsPathEsm(importPath);
      } catch (e) {
        logIt('Using fallback path matching.');
        resolvedFile = matchTsPathFallback?.(importPath);
      }

      if (!resolvedFile) {
        if (tsConfigPathsEsm || tsConfigPathsFallback) {
          logIt(
            `Unable to resolve ${importPath} with tsconfig paths. Using fallback file matching.`
          );
          resolvedFile =
            loadFileFromPaths(tsConfigPathsEsm, importPath) ||
            loadFileFromPaths(tsConfigPathsFallback, importPath);
        } else {
          logIt(`Unable to resolve ${importPath} with tsconfig paths`);
        }
      }

      logIt(`Resolved ${importPath} to ${resolvedFile}`);
      // Returning null defers to other resolveId functions and eventually the default resolution behavior
      // https://rollupjs.org/plugin-development/#resolveid
      return resolvedFile || null;
    },
  };

  function getTsConfig(preferredTsConfigPath: string): string {
    return [
      resolve(preferredTsConfigPath),
      resolve(join(workspaceRoot, 'tsconfig.base.json')),
      resolve(join(workspaceRoot, 'tsconfig.json')),
    ].find((tsPath) => {
      if (existsSync(tsPath)) {
        logIt('Found tsconfig at', tsPath);
        return tsPath;
      }
    });
  }

  function logIt(...msg: any[]) {
    if (process.env.NX_VERBOSE_LOGGING === 'true' || options?.debug) {
      console.debug('\n[Nx Vite TsPaths]', ...msg);
    }
  }

  function loadFileFromPaths(
    tsconfig: ConfigLoaderSuccessResult,
    importPath: string
  ) {
    logIt(
      `Trying to resolve file from config in ${tsconfig.configFileAbsolutePath}`
    );
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
