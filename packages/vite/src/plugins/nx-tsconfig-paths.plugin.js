'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.nxViteTsPaths = nxViteTsPaths;
const devkit_1 = require('@nx/devkit');
const buildable_libs_utils_1 = require('@nx/js/src/utils/buildable-libs-utils');
const ts_solution_setup_1 = require('@nx/js/src/utils/typescript/ts-solution-setup');
const node_fs_1 = require('node:fs');
const node_path_1 = require('node:path');
const tsconfig_paths_1 = require('tsconfig-paths');
const nx_tsconfig_paths_find_file_js_1 = require('../src/utils/nx-tsconfig-paths-find-file.js');
const options_utils_js_1 = require('../src/utils/options-utils.js');
const nx_vite_build_coordination_plugin_js_1 = require('./nx-vite-build-coordination.plugin.js');
function nxViteTsPaths(options = {}) {
  let foundTsConfigPath;
  let matchTsPathEsm;
  let matchTsPathFallback;
  let tsConfigPathsEsm;
  let tsConfigPathsFallback;
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
  let projectRootFromWorkspaceRoot;
  return {
    name: 'nx-vite-ts-paths',
    // Ensure the resolveId aspect of the plugin is called before vite's internal resolver
    // Otherwise, issues can arise with Yarn Workspaces and Pnpm Workspaces
    enforce: 'pre',
    async configResolved(config) {
      projectRoot = config.root;
      projectRootFromWorkspaceRoot = (0, node_path_1.relative)(
        devkit_1.workspaceRoot,
        projectRoot
      );
      foundTsConfigPath = getTsConfig(
        process.env.NX_TSCONFIG_PATH ??
          (0, node_path_1.join)(
            devkit_1.workspaceRoot,
            'tmp',
            projectRootFromWorkspaceRoot,
            process.env.NX_TASK_TARGET_TARGET ?? 'build',
            'tsconfig.generated.json'
          )
      );
      if (!foundTsConfigPath) return;
      if (!options.buildLibsFromSource && !global.NX_GRAPH_CREATION) {
        const projectGraph = await (0, devkit_1.createProjectGraphAsync)({
          exitOnError: false,
          resetDaemonClient: true,
        });
        // When using incremental building and the serve target is called
        // we need to get the deps for the 'build' target instead.
        const depsBuildTarget =
          process.env.NX_TASK_TARGET_TARGET === 'serve' ||
          process.env.NX_TASK_TARGET_TARGET === 'test'
            ? 'build'
            : process.env.NX_TASK_TARGET_TARGET;
        const { dependencies } = (0,
        buildable_libs_utils_1.calculateProjectBuildableDependencies)(
          undefined,
          projectGraph,
          devkit_1.workspaceRoot,
          process.env.NX_TASK_TARGET_PROJECT,
          depsBuildTarget,
          process.env.NX_TASK_TARGET_CONFIGURATION
        );
        if (process.env.NX_GENERATED_TSCONFIG_PATH) {
          // This is needed for vitest browser mode because it runs two vite dev servers
          // so we want to reuse the same tsconfig file for both servers
          foundTsConfigPath = process.env.NX_GENERATED_TSCONFIG_PATH;
        } else {
          // This tsconfig is used via the Vite ts paths plugin.
          // It can be also used by other user-defined Vite plugins (e.g. for creating type declaration files).
          foundTsConfigPath = (0, buildable_libs_utils_1.createTmpTsConfig)(
            foundTsConfigPath,
            devkit_1.workspaceRoot,
            (0, node_path_1.relative)(devkit_1.workspaceRoot, projectRoot),
            dependencies,
            true
          );
          process.env.NX_GENERATED_TSCONFIG_PATH = foundTsConfigPath;
        }
        if (config.command === 'serve') {
          const buildableLibraryDependencies = dependencies
            .filter((dep) => dep.node.type === 'lib')
            .map((dep) => dep.node.name)
            .join(',');
          const buildCommand = `npx nx run-many --target=${depsBuildTarget} --projects=${buildableLibraryDependencies}`;
          config.plugins.push(
            (0,
            nx_vite_build_coordination_plugin_js_1.nxViteBuildCoordinationPlugin)(
              { buildCommand }
            )
          );
        }
      }
      const parsed = (0, tsconfig_paths_1.loadConfig)(foundTsConfigPath);
      logIt('first parsed tsconfig: ', parsed);
      if (parsed.resultType === 'failed') {
        throw new Error(`Failed loading tsconfig at ${foundTsConfigPath}`);
      }
      tsConfigPathsEsm = parsed;
      matchTsPathEsm = (0, tsconfig_paths_1.createMatchPath)(
        parsed.absoluteBaseUrl,
        parsed.paths,
        options.mainFields
      );
      const rootLevelTsConfig = getTsConfig(
        (0, node_path_1.join)(devkit_1.workspaceRoot, 'tsconfig.base.json')
      );
      const rootLevelParsed = (0, tsconfig_paths_1.loadConfig)(
        rootLevelTsConfig
      );
      logIt('fallback parsed tsconfig: ', rootLevelParsed);
      if (rootLevelParsed.resultType === 'success') {
        tsConfigPathsFallback = rootLevelParsed;
        matchTsPathFallback = (0, tsconfig_paths_1.createMatchPath)(
          rootLevelParsed.absoluteBaseUrl,
          rootLevelParsed.paths,
          ['main', 'module']
        );
      }
    },
    resolveId(importPath) {
      // Let other resolvers handle this path.
      if (!foundTsConfigPath) return null;
      let resolvedFile;
      try {
        resolvedFile = matchTsPathEsm(importPath);
      } catch (e) {
        logIt('Using fallback path matching.');
        resolvedFile = matchTsPathFallback?.(importPath);
      }
      if (!resolvedFile || !(0, node_fs_1.existsSync)(resolvedFile)) {
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
      if ((0, ts_solution_setup_1.isUsingTsSolutionSetup)()) return;
      const outDir = options.dir || 'dist';
      const src = (0, node_path_1.resolve)(projectRoot, 'package.json');
      const dest = (0, node_path_1.join)(outDir, 'package.json');
      if ((0, node_fs_1.existsSync)(src) && !(0, node_fs_1.existsSync)(dest)) {
        try {
          (0, node_fs_1.copyFileSync)(src, dest);
        } catch (err) {
          console.error('Error copying package.json:', err);
        }
      }
    },
  };
  function getTsConfig(preferredTsConfigPath) {
    const projectTsConfigPath = (0, options_utils_js_1.getProjectTsConfigPath)(
      projectRootFromWorkspaceRoot
    );
    return [
      (0, node_path_1.resolve)(preferredTsConfigPath),
      projectTsConfigPath
        ? (0, node_path_1.resolve)(
            (0, node_path_1.join)(devkit_1.workspaceRoot, projectTsConfigPath)
          )
        : null,
      (0, node_path_1.resolve)(
        (0, node_path_1.join)(devkit_1.workspaceRoot, 'tsconfig.base.json')
      ),
      (0, node_path_1.resolve)(
        (0, node_path_1.join)(devkit_1.workspaceRoot, 'tsconfig.json')
      ),
      (0, node_path_1.resolve)(
        (0, node_path_1.join)(devkit_1.workspaceRoot, 'jsconfig.json')
      ),
    ]
      .filter(Boolean)
      .find((tsPath) => {
        if ((0, node_fs_1.existsSync)(tsPath)) {
          logIt('Found tsconfig at', tsPath);
          return tsPath;
        }
      });
  }
  function logIt(...msg) {
    if (process.env.NX_VERBOSE_LOGGING === 'true' && options?.debug !== false) {
      console.debug('\n[Nx Vite TsPaths]', ...msg);
    }
  }
  function loadFileFromPaths(tsconfig, importPath) {
    logIt(
      `Trying to resolve file from config in ${tsconfig.configFileAbsolutePath}`
    );
    let resolvedFile;
    for (const alias in tsconfig.paths) {
      const paths = tsconfig.paths[alias];
      const normalizedImport = alias.replace(/\/\*$/, '');
      if (
        importPath === normalizedImport ||
        importPath.startsWith(normalizedImport + '/')
      ) {
        const joinedPath = (0, devkit_1.joinPathFragments)(
          tsconfig.absoluteBaseUrl,
          paths[0].replace(/\/\*$/, '')
        );
        resolvedFile = (0, nx_tsconfig_paths_find_file_js_1.findFile)(
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
          resolvedFile = (0, nx_tsconfig_paths_find_file_js_1.findFile)(
            pathWithoutExtension,
            options.extensions
          );
        }
      }
    }
    return resolvedFile;
  }
}
