import {
  createProjectGraphAsync,
  joinPathFragments,
  stripIndents,
  workspaceRoot,
} from '@nx/devkit';
import { copyFileSync, existsSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
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
import { findFile } from '../src/utils/nx-tsconfig-paths-find-file';
import { isUsingTsSolutionSetup } from '@nx/js/src/utils/typescript/ts-solution-setup';

export interface nxViteTsPathsOptions {
  /**
   * Enable debug logging
   * If set to false, it will always ignore the debug logging even when `--verbose` or `NX_VERBOSE_LOGGING` is set to true.
   * @default undefined
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
  let foundTsConfigPath: string;
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
    '.mts',
    '.mjs',
    '.cts',
    '.cjs',
    '.css',
    '.scss',
    '.less',
  ];
  options.mainFields ??= [['exports', '.', 'import'], 'module', 'main'];
  options.buildLibsFromSource ??= true;
  let projectRoot = '';

  return {
    name: 'nx-vite-ts-paths',
    // Ensure the resolveId aspect of the plugin is called before vite's internal resolver
    // Otherwise, issues can arise with Yarn Workspaces and Pnpm Workspaces
    enforce: 'pre',
    async configResolved(config: any) {
      projectRoot = config.root;
      const projectRootFromWorkspaceRoot = relative(workspaceRoot, projectRoot);
      foundTsConfigPath = getTsConfig(
        process.env.NX_TSCONFIG_PATH ??
          join(
            workspaceRoot,
            'tmp',
            projectRootFromWorkspaceRoot,
            process.env.NX_TASK_TARGET_TARGET ?? 'build',
            'tsconfig.generated.json'
          )
      );

      if (!foundTsConfigPath) return;

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
          dependencies,
          true
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
      // Let other resolvers handle this path.
      if (!foundTsConfigPath) return null;

      let resolvedFile: string;
      try {
        resolvedFile = matchTsPathEsm(importPath);
      } catch (e) {
        logIt('Using fallback path matching.');
        resolvedFile = matchTsPathFallback?.(importPath);
      }

      if (!resolvedFile || !existsSync(resolvedFile)) {
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
      if (isUsingTsSolutionSetup()) return;
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
      resolve(join(workspaceRoot, 'jsconfig.json')),
    ].find((tsPath) => {
      if (existsSync(tsPath)) {
        logIt('Found tsconfig at', tsPath);
        return tsPath;
      }
    });
  }

  function logIt(...msg: any[]) {
    if (process.env.NX_VERBOSE_LOGGING === 'true' && options?.debug !== false) {
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

      if (
        importPath === normalizedImport ||
        importPath.startsWith(normalizedImport + '/')
      ) {
        const joinedPath = joinPathFragments(
          tsconfig.absoluteBaseUrl,
          paths[0].replace(/\/\*$/, '')
        );

        resolvedFile = findFile(
          importPath.replace(normalizedImport, joinedPath),
          options.extensions
        );

        if (
          resolvedFile === undefined &&
          options.extensions.some((ext) => importPath.endsWith(ext))
        ) {
          const foundExtension = options.extensions.find((ext) =>
            importPath.endsWith(ext)
          );
          const pathWithoutExtension = importPath
            .replace(normalizedImport, joinedPath)
            .slice(0, -foundExtension.length);
          resolvedFile = findFile(pathWithoutExtension, options.extensions);
        }
      }
    }

    return resolvedFile;
  }
}
