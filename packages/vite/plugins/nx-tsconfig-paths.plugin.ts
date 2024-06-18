import {
  createProjectGraphAsync,
  joinPathFragments,
  stripIndents,
  workspaceRoot,
} from '@nx/devkit';
import { copyFileSync, existsSync } from 'node:fs';
import { relative, join, resolve } from 'node:path';
import {
  loadConfig,
  createMatchPath,
  MatchPath,
  ConfigLoaderSuccessResult,
} from 'tsconfig-paths';
import {
  calculateProjectBuildableDependencies,
  createTmpTsConfig,
} from '@nx/js/src/utils/buildable-libs-utils';
import { Plugin } from 'vite';
import { nxViteBuildCoordinationPlugin } from './nx-vite-build-coordination.plugin';

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
  /**
   * Inform Nx whether to use the raw source or to use the built output for buildable dependencies.
   * Set to `false` to use incremental builds.
   * @default true
   */
  buildLibsFromSource?: boolean;
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
  options.buildLibsFromSource ??= true;
  let projectRoot = '';

  return {
    name: 'nx-vite-ts-paths',
    async configResolved(config: any) {
      projectRoot = config.root;
      const projectRootFromWorkspaceRoot = relative(workspaceRoot, projectRoot);
      let foundTsConfigPath = getTsConfig(
        join(
          workspaceRoot,
          'tmp',
          projectRootFromWorkspaceRoot,
          process.env.NX_TASK_TARGET_TARGET ?? 'build',
          'tsconfig.generated.json'
        )
      );
      if (!foundTsConfigPath) {
        throw new Error(stripIndents`Unable to find a tsconfig in the workspace! 
There should at least be a tsconfig.base.json or tsconfig.json in the root of the workspace ${workspaceRoot}`);
      }

      if (
        !options.buildLibsFromSource &&
        !global.NX_GRAPH_CREATION &&
        config.mode !== 'test'
      ) {
        const projectGraph = await createProjectGraphAsync({
          exitOnError: false,
          resetDaemonClient: true,
        });
        const { dependencies } = calculateProjectBuildableDependencies(
          undefined,
          projectGraph,
          workspaceRoot,
          process.env.NX_TASK_TARGET_PROJECT,
          // When using incremental building and the serve target is called
          // we need to get the deps for the 'build' target instead.
          process.env.NX_TASK_TARGET_TARGET === 'serve'
            ? 'build'
            : process.env.NX_TASK_TARGET_TARGET,
          process.env.NX_TASK_TARGET_CONFIGURATION
        );
        // This tsconfig is used via the Vite ts paths plugin.
        // It can be also used by other user-defined Vite plugins (e.g. for creating type declaration files).
        foundTsConfigPath = createTmpTsConfig(
          foundTsConfigPath,
          workspaceRoot,
          relative(workspaceRoot, projectRoot),
          dependencies
        );

        if (config.command === 'serve') {
          const buildableLibraryDependencies = dependencies
            .filter((dep) => dep.node.type === 'lib')
            .map((dep) => dep.node.name)
            .join(',');
          const buildCommand = `npx nx run-many --target=${process.env.NX_TASK_TARGET_TARGET} --projects=${buildableLibraryDependencies}`;
          config.plugins.push(nxViteBuildCoordinationPlugin({ buildCommand }));
        }
      }

      const parsed = loadConfig(foundTsConfigPath);

      logIt('first parsed tsconfig: ', parsed);
      if (parsed.resultType === 'failed') {
        throw new Error(`Failed loading tsconfig at ${foundTsConfigPath}`);
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
    async writeBundle(options) {
      const outDir = options.dir || 'dist';
      const src = resolve(projectRoot, 'package.json');
      if (existsSync(src)) {
        const dest = join(outDir, 'package.json');

        try {
          copyFileSync(src, dest);
        } catch (err) {
          console.error('Error copying package.json:', err);
        }
      }
    },
  } as Plugin;

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
