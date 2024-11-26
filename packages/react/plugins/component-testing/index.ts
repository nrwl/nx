import {
  nxBaseCypressPreset,
  NxComponentTestingOptions,
} from '@nx/cypress/plugins/cypress-preset';
import type { CypressExecutorOptions } from '@nx/cypress/src/executors/cypress/cypress.impl';
import {
  ExecutorContext,
  joinPathFragments,
  logger,
  parseTargetString,
  readCachedProjectGraph,
  readTargetOptions,
  stripIndents,
  Target,
  workspaceRoot,
} from '@nx/devkit';
import {
  createExecutorContext,
  getProjectConfigByPath,
} from '@nx/cypress/src/utils/ct-helpers';

import { existsSync } from 'fs';
import { dirname, join } from 'path';

type ViteDevServer = {
  framework: 'react';
  bundler: 'vite';
  viteConfig?: any;
};

type WebpackDevServer = {
  framework: 'react';
  bundler: 'webpack';
  webpackConfig?: any;
};

/**
 * React nx preset for Cypress Component Testing
 *
 * This preset contains the base configuration
 * for your component tests that nx recommends.
 * including a devServer that supports nx workspaces.
 * you can easily extend this within your cypress config via spreading the preset
 * @example
 * export default defineConfig({
 *   component: {
 *     ...nxComponentTestingPreset(__dirname)
 *     // add your own config here
 *   }
 * })
 *
 * @param pathToConfig will be used for loading project options and to construct the output paths for videos and screenshots
 * @param options override options
 */
export function nxComponentTestingPreset(
  pathToConfig: string,
  options?: NxComponentTestingOptions
): {
  specPattern: string;
  devServer: ViteDevServer | WebpackDevServer;
  videosFolder: string;
  screenshotsFolder: string;
  chromeWebSecurity: boolean;
} {
  const basePresetSettings = nxBaseCypressPreset(pathToConfig, {
    testingType: 'component',
  });

  if (global.NX_GRAPH_CREATION) {
    // this is only used by plugins, so we don't need the component testing
    // options, cast to any to avoid type errors
    return basePresetSettings as any;
  }

  const normalizedProjectRootPath = ['.ts', '.js'].some((ext) =>
    pathToConfig.endsWith(ext)
  )
    ? pathToConfig
    : dirname(pathToConfig);

  if (options?.bundler === 'vite') {
    return {
      ...basePresetSettings,
      specPattern: 'src/**/*.cy.{js,jsx,ts,tsx}',
      devServer: {
        ...({ framework: 'react', bundler: 'vite' } as const),
        viteConfig: async () => {
          const viteConfigPath = findViteConfig(normalizedProjectRootPath);

          const { mergeConfig, loadConfigFromFile, searchForWorkspaceRoot } =
            await (Function('return import("vite")')() as Promise<
              typeof import('vite')
            >);

          const resolved = await loadConfigFromFile(
            {
              mode: 'watch',
              command: 'serve',
            },
            viteConfigPath
          );
          return mergeConfig(resolved.config, {
            server: {
              fs: {
                allow: [
                  searchForWorkspaceRoot(normalizedProjectRootPath),
                  workspaceRoot,
                  joinPathFragments(workspaceRoot, 'node_modules/vite'),
                ],
              },
            },
          });
        },
      },
    };
  }

  let webpackConfig: any;
  try {
    const graph = readCachedProjectGraph();
    const { targets: ctTargets, name: ctProjectName } = getProjectConfigByPath(
      graph,
      pathToConfig
    );
    const ctTargetName = options?.ctTargetName || 'component-test';
    const ctConfigurationName = process.env.NX_CYPRESS_TARGET_CONFIGURATION;

    const ctExecutorContext = createExecutorContext(
      graph,
      ctTargets,
      ctProjectName,
      ctTargetName,
      ctConfigurationName
    );

    let buildTarget: string = options?.buildTarget;
    if (!buildTarget) {
      const ctExecutorOptions = readTargetOptions<CypressExecutorOptions>(
        {
          project: ctProjectName,
          target: ctTargetName,
          configuration: ctConfigurationName,
        },
        ctExecutorContext
      );

      buildTarget = ctExecutorOptions.devServerTarget;
    }

    if (!buildTarget) {
      throw new Error(
        `Unable to find the 'devServerTarget' executor option in the '${ctTargetName}' target of the '${ctProjectName}' project`
      );
    }

    webpackConfig = buildTargetWebpack(
      ctExecutorContext,
      buildTarget,
      ctProjectName
    );
  } catch (e) {
    if (e instanceof InvalidExecutorError) {
      throw e;
    }

    logger.warn(
      stripIndents`Unable to build a webpack config with the project graph. 
      Falling back to default webpack config.`
    );
    logger.warn(e);

    const { buildBaseWebpackConfig } = require('./webpack-fallback');
    webpackConfig = buildBaseWebpackConfig({
      tsConfigPath: findTsConfig(normalizedProjectRootPath),
      compiler: options?.compiler || 'babel',
    });
  }

  return {
    ...basePresetSettings,
    specPattern: 'src/**/*.cy.{js,jsx,ts,tsx}',
    devServer: {
      // cypress uses string union type,
      // need to use const to prevent typing to string
      // but don't want to use as const on webpackConfig
      // so it is still user modifiable
      ...({ framework: 'react', bundler: 'webpack' } as const),
      webpackConfig,
    },
  };
}

/**
 * apply the schema.json defaults from the @nx/web:webpack executor to the target options
 */
function withSchemaDefaults(target: Target, context: ExecutorContext) {
  const options = readTargetOptions(target, context);

  options.compiler ??= 'babel';
  options.deleteOutputPath ??= true;
  options.vendorChunk ??= true;
  options.commonChunk ??= true;
  options.runtimeChunk ??= true;
  options.sourceMap ??= true;
  options.assets ??= [];
  options.scripts ??= [];
  options.styles ??= [];
  options.budgets ??= [];
  options.namedChunks ??= true;
  options.outputHashing ??= 'none';
  options.extractCss ??= true;
  options.memoryLimit ??= 2048;
  options.maxWorkers ??= 2;
  options.fileReplacements ??= [];
  options.buildLibsFromSource ??= true;
  return options;
}

function buildTargetWebpack(
  ctx: ExecutorContext,
  buildTarget: string,
  componentTestingProjectName: string
) {
  const graph = ctx.projectGraph;
  const parsed = parseTargetString(buildTarget, graph);

  const buildableProjectConfig = graph.nodes[parsed.project]?.data;
  const ctProjectConfig = graph.nodes[componentTestingProjectName]?.data;

  if (!buildableProjectConfig || !ctProjectConfig) {
    throw new Error(stripIndents`Unable to load project configs from graph. 
    Using build target '${buildTarget}'
    Has build config? ${!!buildableProjectConfig}
    Has component config? ${!!ctProjectConfig}
    `);
  }

  if (
    buildableProjectConfig.targets[parsed.target].executor !==
    '@nx/webpack:webpack'
  ) {
    throw new InvalidExecutorError(
      `The '${parsed.target}' target of the '${parsed.project}' project is not using the '@nx/webpack:webpack' executor. ` +
        `Please make sure to use '@nx/webpack:webpack' executor in that target to use Cypress Component Testing.`
    );
  }

  const context = createExecutorContext(
    graph,
    buildableProjectConfig.targets,
    parsed.project,
    parsed.target,
    parsed.target
  );

  const {
    normalizeOptions,
  } = require('@nx/webpack/src/executors/webpack/lib/normalize-options');
  const {
    resolveUserDefinedWebpackConfig,
  } = require('@nx/webpack/src/utils/webpack/resolve-user-defined-webpack-config');
  const { composePluginsSync } = require('@nx/webpack/src/utils/config');
  const { withNx } = require('@nx/webpack/src/utils/with-nx');
  const { withWeb } = require('@nx/webpack/src/utils/with-web');

  const options = normalizeOptions(
    withSchemaDefaults(parsed, context),
    workspaceRoot,
    buildableProjectConfig.root!,
    buildableProjectConfig.sourceRoot!
  );

  let customWebpack: any;

  if (options.webpackConfig) {
    customWebpack = resolveUserDefinedWebpackConfig(
      options.webpackConfig,
      options.tsConfig.startsWith(context.root)
        ? options.tsConfig
        : join(context.root, options.tsConfig)
    );
  }

  return async () => {
    customWebpack = await customWebpack;
    // TODO(v21): Component testing need to be agnostic of the underlying executor. With Crystal, we're not using `@nx/webpack:webpack` by default.
    // We need to decouple CT from the build target of the app, we just care about bundler config (e.g. webpack.config.js).
    // The generated setup should support both Webpack and Vite as documented here: https://docs.cypress.io/guides/component-testing/react/overview
    // Related issue: https://github.com/nrwl/nx/issues/21546
    const configure = composePluginsSync(withNx(), withWeb());
    const defaultWebpack = configure(
      {},
      {
        options: {
          ...options,
          // cypress will generate its own index.html from component-index.html
          generateIndexHtml: false,
          // causes issues with buildable libraries with ENOENT: no such file or directory, scandir error
          extractLicenses: false,
          root: workspaceRoot,
          projectRoot: ctProjectConfig.root,
          sourceRoot: ctProjectConfig.sourceRoot,
        },
        context,
      }
    );

    if (customWebpack) {
      return await customWebpack(defaultWebpack, {
        options,
        context,
        configuration: parsed.configuration,
      });
    }

    return defaultWebpack;
  };
}

function findViteConfig(projectRootFullPath: string): string {
  const allowsExt = ['js', 'mjs', 'ts', 'cjs', 'mts', 'cts'];

  for (const ext of allowsExt) {
    if (existsSync(join(projectRootFullPath, `vite.config.${ext}`))) {
      return join(projectRootFullPath, `vite.config.${ext}`);
    }
  }
}

function findTsConfig(projectRoot: string) {
  const potentialConfigs = [
    'cypress/tsconfig.json',
    'cypress/tsconfig.cy.json',
    'tsconfig.cy.json',
  ];

  for (const config of potentialConfigs) {
    if (existsSync(join(projectRoot, config))) {
      return config;
    }
  }
}

class InvalidExecutorError extends Error {
  constructor(public message: string) {
    super(message);
    this.name = 'InvalidExecutorError';
  }
}
