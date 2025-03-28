/**
 * WARNING: Do not add development dependencies to top-level imports.
 * Instead, `require` them inline during the build phase.
 */
import type { NextConfig } from 'next';
import type { NextConfigFn } from '../src/utils/config';
import type { NextBuildBuilderOptions } from '../src/utils/types';
import {
  type ExecutorContext,
  type ProjectGraph,
  type ProjectGraphProjectNode,
  type Target,
} from '@nx/devkit';
import type { AssetGlobPattern } from '@nx/webpack';

export interface SvgrOptions {
  svgo?: boolean;
  titleProp?: boolean;
  ref?: boolean;
}

export interface WithNxOptions extends NextConfig {
  nx?: {
    /**
     * @deprecated Next.js via turbo conflicts with how webpack handles the import of SVGs.
     * It is best to configure SVGR manually with the `@svgr/webpack` loader.
     * We will remove this option in Nx 21.
     * */
    svgr?: boolean | SvgrOptions;
    babelUpwardRootMode?: boolean;
    fileReplacements?: { replace: string; with: string }[];
    assets?: AssetGlobPattern[];
  };
}

export interface WithNxContext {
  workspaceRoot: string;
  libsDir: string;
}

function regexEqual(x, y) {
  return (
    x instanceof RegExp &&
    y instanceof RegExp &&
    x.source === y.source &&
    x.global === y.global &&
    x.ignoreCase === y.ignoreCase &&
    x.multiline === y.multiline
  );
}

/**
 * Do not remove or rename this function. Production builds inline `with-nx.js` file with a replacement
 * To this function that hard-codes the libsDir.
 */
function getWithNxContext(): WithNxContext {
  const { workspaceRoot, workspaceLayout } = require('@nx/devkit');
  return {
    workspaceRoot,
    libsDir: workspaceLayout().libsDir,
  };
}

function getNxContext(
  graph: ProjectGraph,
  target: Target
): {
  node: ProjectGraphProjectNode;
  options: NextBuildBuilderOptions;
  projectName: string;
  targetName: string;
  configurationName?: string;
} {
  const { parseTargetString, workspaceRoot } = require('@nx/devkit');
  const projectNode = graph.nodes[target.project];
  const targetConfig = projectNode.data.targets[target.target];
  const targetOptions = targetConfig.options;
  if (target.configuration) {
    Object.assign(
      targetOptions,
      targetConfig.configurations[target.configuration]
    );
  }

  const partialExecutorContext: Partial<ExecutorContext> = {
    projectName: target.project,
    targetName: target.target,
    projectGraph: graph,
    configurationName: target.configuration,
    root: workspaceRoot,
  };

  if (targetOptions.devServerTarget) {
    // Executors such as @nx/cypress:cypress define the devServerTarget option.
    return getNxContext(
      graph,
      parseTargetString(targetOptions.devServerTarget, partialExecutorContext)
    );
  } else if (targetOptions.buildTarget) {
    // Executors such as @nx/next:server define the buildTarget option.
    return getNxContext(
      graph,
      parseTargetString(targetOptions.buildTarget, partialExecutorContext)
    );
  }

  // Default case, return info for current target.
  // This could be a build using @nx/next:build or run-commands without using our executors.
  return {
    node: graph.nodes[target.project],
    options: targetOptions,
    projectName: target.project,
    targetName: target.target,
    configurationName: target.configuration,
  };
}

/**
 * Try to read output dir from project, and default to '.next' if executing outside of Nx (e.g. dist is added to a docker image).
 */
function withNx(
  _nextConfig = {} as WithNxOptions,
  context: WithNxContext = getWithNxContext()
): NextConfigFn {
  return async (phase: string) => {
    const { PHASE_PRODUCTION_SERVER, PHASE_DEVELOPMENT_SERVER } = await import(
      'next/constants'
    );
    // Three scenarios where we want to skip graph creation:
    // 1. Running production server means the build is already done so we just need to start the Next.js server.
    // 2. During graph creation (i.e. create nodes), we won't have a graph to read, and it is not needed anyway since it's a build-time concern.
    // 3. Running outside of Nx, we don't have a graph to read.
    //
    // NOTE: Avoid any `require(...)` or `import(...)` statements here. Development dependencies are not available at production runtime.
    if (
      PHASE_PRODUCTION_SERVER === phase ||
      global.NX_GRAPH_CREATION ||
      !process.env.NX_TASK_TARGET_TARGET
    ) {
      const { nx, ...validNextConfig } = _nextConfig;
      return {
        distDir: '.next',
        ...validNextConfig,
      };
    } else {
      const {
        createProjectGraphAsync,
        joinPathFragments,
        offsetFromRoot,
        workspaceRoot,
      } = require('@nx/devkit');

      let graph: ProjectGraph;
      try {
        graph = await createProjectGraphAsync();
      } catch (e) {
        throw new Error(
          'Could not create project graph. Please ensure that your workspace is valid.',
          { cause: e }
        );
      }

      const originalTarget = {
        project: process.env.NX_TASK_TARGET_PROJECT,
        target: process.env.NX_TASK_TARGET_TARGET,
        configuration: process.env.NX_TASK_TARGET_CONFIGURATION,
      };

      const {
        node: projectNode,
        options,
        projectName: project,
      } = getNxContext(graph, originalTarget);
      const projectDirectory = projectNode.data.root;

      // Get next config
      const nextConfig = getNextConfig(_nextConfig, context);

      // For Next.js 13.1 and greater, make sure workspace libs are transpiled.
      forNextVersion('>=13.1.0', () => {
        if (!graph.dependencies[project]) return;

        const { readTsConfigPaths } = require('@nx/js');
        const {
          findAllProjectNodeDependencies,
        } = require('nx/src/utils/project-graph-utils');
        const paths = readTsConfigPaths();
        const deps = findAllProjectNodeDependencies(project);
        nextConfig.transpilePackages ??= [];

        for (const dep of deps) {
          const alias = getAliasForProject(graph.nodes[dep], paths);
          if (alias) {
            nextConfig.transpilePackages.push(alias);
          }
        }
      });

      // process.env.NX_NEXT_OUTPUT_PATH is set when running @nx/next:build
      options.outputPath =
        process.env.NX_NEXT_OUTPUT_PATH || options.outputPath;

      // outputPath may be undefined if using run-commands or other executors other than @nx/next:build.
      // In this case, the user should set distDir in their next.config.js.
      if (options.outputPath && phase !== PHASE_DEVELOPMENT_SERVER) {
        const outputDir = `${offsetFromRoot(projectDirectory)}${
          options.outputPath
        }`;
        // If running dev-server, we should keep `.next` inside project directory since Turbopack expects this.
        // See: https://github.com/nrwl/nx/issues/19365
        nextConfig.distDir =
          nextConfig.distDir && nextConfig.distDir !== '.next'
            ? joinPathFragments(outputDir, nextConfig.distDir)
            : joinPathFragments(outputDir, '.next');
      }

      // If we are running a static serve of the Next.js app, we need to change the output to 'export' and the distDir to 'out'.
      if (process.env.NX_SERVE_STATIC_BUILD_RUNNING === 'true') {
        nextConfig.output = 'export';
        nextConfig.distDir = 'out';
      }

      const userWebpackConfig = nextConfig.webpack;

      const { createWebpackConfig } = require(require.resolve(
        '@nx/next/src/utils/config',
        {
          paths: [workspaceRoot],
        }
      )) as typeof import('@nx/next/src/utils/config');
      // If we have file replacements or assets, inside of the next config we pass the workspaceRoot as a join of the workspaceRoot and the projectDirectory
      // Because the file replacements and assets are relative to the projectRoot, not the workspaceRoot
      nextConfig.webpack = (a, b) =>
        createWebpackConfig(
          _nextConfig.nx?.fileReplacements
            ? joinPathFragments(workspaceRoot, projectDirectory)
            : workspaceRoot,
          projectDirectory,
          _nextConfig.nx?.fileReplacements || options.fileReplacements,
          _nextConfig.nx?.assets || options.assets
        )(userWebpackConfig ? userWebpackConfig(a, b) : a, b);

      return nextConfig;
    }
  };
}

export function getNextConfig(
  nextConfig = {} as WithNxOptions,
  context: WithNxContext = getWithNxContext()
): NextConfig {
  // If `next-compose-plugins` is used, the context argument is invalid.
  if (!context.libsDir || !context.workspaceRoot) {
    context = getWithNxContext();
  }
  const userWebpack = nextConfig.webpack || ((x) => x);
  const { nx, ...validNextConfig } = nextConfig;
  return {
    eslint: {
      ignoreDuringBuilds: true,
      ...(validNextConfig.eslint ?? {}),
    },
    ...validNextConfig,
    webpack: (config, options) => {
      /*
       * Update babel to support our monorepo setup.
       * The 'upward' mode allows the root babel.config.json and per-project .babelrc files to be picked up.
       */
      if (nx?.babelUpwardRootMode) {
        options.defaultLoaders.babel.options.babelrc = true;
        options.defaultLoaders.babel.options.rootMode = 'upward';
      }

      /*
       * Modify the Next.js webpack config to allow workspace libs to use css modules.
       * Note: This would be easier if Next.js exposes css-loader and sass-loader on `defaultLoaders`.
       */

      // Include workspace libs in css/sass loaders
      const includes = [
        require('path').join(context.workspaceRoot, context.libsDir),
      ];

      const nextCssLoaders = config.module.rules.find(
        (rule) => typeof rule.oneOf === 'object'
      );

      // webpack config is not as expected
      if (!nextCssLoaders) return config;

      /*
       *  1. Modify css loader to enable module support for workspace libs
       */
      const nextCssLoader = nextCssLoaders.oneOf.find(
        (rule) =>
          rule.sideEffects === false && regexEqual(rule.test, /\.module\.css$/)
      );
      // Might not be found if Next.js webpack config changes in the future
      if (nextCssLoader && nextCssLoader.issuer) {
        nextCssLoader.issuer.or = nextCssLoader.issuer.and
          ? nextCssLoader.issuer.and.concat(includes)
          : includes;
        delete nextCssLoader.issuer.and;
      }

      /*
       *  2. Modify sass loader to enable module support for workspace libs
       */
      const nextSassLoader = nextCssLoaders.oneOf.find(
        (rule) =>
          rule.sideEffects === false &&
          regexEqual(rule.test, /\.module\.(scss|sass)$/)
      );
      // Might not be found if Next.js webpack config changes in the future
      if (nextSassLoader && nextSassLoader.issuer) {
        nextSassLoader.issuer.or = nextSassLoader.issuer.and
          ? nextSassLoader.issuer.and.concat(includes)
          : includes;
        delete nextSassLoader.issuer.and;
      }

      /*
       *  3. Modify error loader to ignore css modules used by workspace libs
       */
      const nextErrorCssModuleLoader = nextCssLoaders.oneOf.find(
        (rule) =>
          rule.use &&
          rule.use.loader === 'error-loader' &&
          rule.use.options &&
          (rule.use.options.reason ===
            'CSS Modules \u001b[1mcannot\u001b[22m be imported from within \u001b[1mnode_modules\u001b[22m.\n' +
              'Read more: https://err.sh/next.js/css-modules-npm' ||
            rule.use.options.reason ===
              'CSS Modules cannot be imported from within node_modules.\nRead more: https://err.sh/next.js/css-modules-npm')
      );
      // Might not be found if Next.js webpack config changes in the future
      if (nextErrorCssModuleLoader) {
        nextErrorCssModuleLoader.exclude = includes;
      }

      /**
       * 4. Modify css loader to allow global css from node_modules to be imported from workspace libs
       */
      const nextGlobalCssLoader = nextCssLoaders.oneOf.find((rule) =>
        rule.include?.and?.find((include) =>
          regexEqual(include, /node_modules/)
        )
      );
      // Might not be found if Next.js webpack config changes in the future
      if (nextGlobalCssLoader && nextGlobalCssLoader.issuer) {
        nextGlobalCssLoader.issuer.or = nextGlobalCssLoader.issuer.and
          ? nextGlobalCssLoader.issuer.and.concat(includes)
          : includes;
        delete nextGlobalCssLoader.issuer.and;
      }

      /**
       * 5. Add SVGR support if option is on.
       */

      // Default SVGR support to be on for projects.
      if (nx?.svgr !== false || typeof nx?.svgr === 'object') {
        forNextVersion('>=15.0.0', () => {
          // Since Next.js 15, turbopack could be enabled by default.
          console.warn(
            `NX: Next.js SVGR support is deprecated. If used with turbopack, it may not work as expected and is not recommended. Please configure SVGR manually.`
          );
        });
        const defaultSvgrOptions = {
          svgo: false,
          titleProp: true,
          ref: true,
        };

        const svgrOptions =
          typeof nx?.svgr === 'object' ? nx.svgr : defaultSvgrOptions;
        // TODO(v21): Remove file-loader and use `?react` querystring to differentiate between asset and SVGR.
        // It should be:
        // use: [{
        //   test: /\.svg$/i,
        //   type: 'asset',
        //   resourceQuery: /react/, // *.svg?react
        // },
        // {
        //   test: /\.svg$/i,
        //   issuer: /\.[jt]sx?$/,
        //   resourceQuery: { not: [/react/] }, // exclude react component if *.svg?react
        //   use: ['@svgr/webpack'],
        // }],
        // See:
        // - SVGR: https://react-svgr.com/docs/webpack/#use-svgr-and-asset-svg-in-the-same-project
        // - Vite: https://www.npmjs.com/package/vite-plugin-svgr
        // - Rsbuild: https://github.com/web-infra-dev/rsbuild/pull/1783
        // Note: We also need a migration for any projects that are using SVGR to convert
        //       `import { ReactComponent as X } from './x.svg` to
        //       `import X from './x.svg?react';
        config.module.rules.push({
          test: /\.svg$/,
          issuer: { not: /\.(css|scss|sass)$/ },
          resourceQuery: {
            not: [
              /__next_metadata__/,
              /__next_metadata_route__/,
              /__next_metadata_image_meta__/,
            ],
          },
          use: [
            {
              loader: require.resolve('@svgr/webpack'),
              options: svgrOptions,
            },
            {
              loader: require.resolve('file-loader'),
              options: {
                // Next.js hard-codes assets to load from "static/media".
                // See: https://github.com/vercel/next.js/blob/53d017d/packages/next/src/build/webpack-config.ts#L1993
                name: 'static/media/[name].[hash].[ext]',
              },
            },
          ],
        });
      }

      return userWebpack(config, options);
    },
  };
}

export function getAliasForProject(
  node: ProjectGraphProjectNode,
  paths: Record<string, string[]>
): null | string {
  // Match workspace libs to their alias in tsconfig paths.
  for (const [alias, lookup] of Object.entries(paths ?? {})) {
    const lookupContainsDepNode = lookup.some(
      (lookupPath) =>
        lookupPath.startsWith(node?.data?.root) ||
        lookupPath.startsWith('./' + node?.data?.root)
    );
    if (lookupContainsDepNode) {
      return alias;
    }
  }

  return null;
}

// Runs a function if the Next.js version satisfies the range.
export function forNextVersion(range: string, fn: () => void) {
  const semver = require('semver');
  const nextJsVersion = require('next/package.json').version;
  if (semver.satisfies(nextJsVersion, range, { includePrerelease: true })) {
    fn();
  }
}

// Support for older generated code: `const withNx = require('@nx/next/plugins/with-nx');`
module.exports = withNx;
// Support for newer generated code: `const { withNx } = require(...);`
module.exports.withNx = withNx;
module.exports.getNextConfig = getNextConfig;
module.exports.getAliasForProject = getAliasForProject;

export { withNx };
