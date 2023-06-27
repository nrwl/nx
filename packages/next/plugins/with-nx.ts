/**
 * WARNING: Do not add development dependencies to top-level imports.
 * Instead, `require` them inline during the build phase.
 */
import type { NextConfig } from 'next';
import type { NextConfigFn } from '../src/utils/config';
import type { NextBuildBuilderOptions } from '../src/utils/types';
import type { DependentBuildableProjectNode } from '@nx/js/src/utils/buildable-libs-utils';
import type { ProjectGraph, ProjectGraphProjectNode, Target } from '@nx/devkit';

export interface WithNxOptions extends NextConfig {
  nx?: {
    svgr?: boolean;
    babelUpwardRootMode?: boolean;
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
  const { parseTargetString } = require('@nx/devkit');
  const projectNode = graph.nodes[target.project];
  const targetConfig = projectNode.data.targets[target.target];
  const targetOptions = targetConfig.options;
  if (target.configuration) {
    Object.assign(
      targetOptions,
      targetConfig.configurations[target.configuration]
    );
  }

  if (targetOptions.devServerTarget) {
    // Executors such as @nx/cypress:cypress define the devServerTarget option.
    return getNxContext(
      graph,
      parseTargetString(targetOptions.devServerTarget, graph)
    );
  } else if (targetOptions.buildTarget) {
    // Executors such as @nx/next:server or @nx/next:export define the buildTarget option.
    return getNxContext(
      graph,
      parseTargetString(targetOptions.buildTarget, graph)
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
    const { PHASE_PRODUCTION_SERVER } = await import('next/constants');
    if (phase === PHASE_PRODUCTION_SERVER) {
      // If we are running an already built production server, just return the configuration.
      // NOTE: Avoid any `require(...)` or `import(...)` statements here. Development dependencies are not available at production runtime.
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

      // Otherwise, add in webpack and eslint configuration for build or test.
      let dependencies: DependentBuildableProjectNode[] = [];

      const graph = await createProjectGraphAsync();

      const originalTarget = {
        project: process.env.NX_TASK_TARGET_PROJECT,
        target: process.env.NX_TASK_TARGET_TARGET,
        configuration: process.env.NX_TASK_TARGET_CONFIGURATION,
      };

      const {
        node: projectNode,
        options,
        projectName: project,
        targetName,
        configurationName,
      } = getNxContext(graph, originalTarget);
      const projectDirectory = projectNode.data.root;

      if (options.buildLibsFromSource === false && targetName) {
        const {
          calculateProjectDependencies,
        } = require('@nx/js/src/utils/buildable-libs-utils');
        const result = calculateProjectDependencies(
          graph,
          workspaceRoot,
          project,
          targetName,
          configurationName
        );
        dependencies = result.dependencies;
      }

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

      // outputPath may be undefined if using run-commands or other executors other than @nx/next:build.
      // In this case, the user should set distDir in their next.config.js.
      if (options.outputPath) {
        const outputDir = `${offsetFromRoot(projectDirectory)}${
          options.outputPath
        }`;
        nextConfig.distDir =
          nextConfig.distDir && nextConfig.distDir !== '.next'
            ? joinPathFragments(outputDir, nextConfig.distDir)
            : joinPathFragments(outputDir, '.next');
      }

      const userWebpackConfig = nextConfig.webpack;

      const { createWebpackConfig } = require('../src/utils/config');
      nextConfig.webpack = (a, b) =>
        createWebpackConfig(
          workspaceRoot,
          projectDirectory,
          options.fileReplacements,
          options.assets
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
       * 5. Add env variables prefixed with NX_
       */
      addNxEnvVariables(config);

      /**
       * 6. Add SVGR support if option is on.
       */

      // Default SVGR support to be on for projects.
      if (nx?.svgr !== false) {
        config.module.rules.push({
          test: /\.svg$/,
          oneOf: [
            // If coming from JS/TS file, then transform into React component using SVGR.
            {
              issuer: /\.[jt]sx?$/,
              use: [
                {
                  loader: require.resolve('@svgr/webpack'),
                  options: {
                    svgo: false,
                    titleProp: true,
                    ref: true,
                  },
                },
                {
                  loader: require.resolve('url-loader'),
                  options: {
                    limit: 10000, // 10kB
                    name: '[name].[hash:7].[ext]',
                  },
                },
              ],
            },
            // Fallback to plain URL loader if someone just imports the SVG and references it on the <img src> tag
            {
              loader: require.resolve('url-loader'),
              options: {
                limit: 10000, // 10kB
                name: '[name].[hash:7].[ext]',
              },
            },
          ],
        });
      }

      return userWebpack(config, options);
    },
  };
}

function getNxEnvironmentVariables() {
  return Object.keys(process.env)
    .filter((env) => /^NX_/i.test(env))
    .reduce((env, key) => {
      env[key] = process.env[key];
      return env;
    }, {});
}

function addNxEnvVariables(config: any) {
  const maybeDefinePlugin = config.plugins?.find((plugin) => {
    return plugin.definitions?.['process.env.NODE_ENV'];
  });

  if (maybeDefinePlugin) {
    const env = getNxEnvironmentVariables();

    Object.entries(env)
      .map(([name, value]) => [`process.env.${name}`, `"${value}"`])
      .filter(([name]) => !maybeDefinePlugin.definitions[name])
      .forEach(
        ([name, value]) => (maybeDefinePlugin.definitions[name] = value)
      );
  }
}

export function getAliasForProject(
  node: ProjectGraphProjectNode,
  paths: Record<string, string[]>
): null | string {
  // Match workspace libs to their alias in tsconfig paths.
  for (const [alias, lookup] of Object.entries(paths)) {
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
  if (semver.satisfies(nextJsVersion, range)) {
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
