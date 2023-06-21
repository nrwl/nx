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
  ProjectGraph,
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
  video: boolean;
  chromeWebSecurity: boolean;
} {
  const normalizedProjectRootPath = ['.ts', '.js'].some((ext) =>
    pathToConfig.endsWith(ext)
  )
    ? pathToConfig
    : dirname(pathToConfig);

  const basePresetSettings = nxBaseCypressPreset(pathToConfig, {
    testingType: 'component',
  });

  if (options?.bundler === 'vite') {
    return {
      ...basePresetSettings,
      specPattern: 'src/**/*.cy.{js,jsx,ts,tsx}',
      devServer: {
        ...({ framework: 'react', bundler: 'vite' } as const),
        viteConfig: async () => {
          const viteConfigPath = findViteConfig(normalizedProjectRootPath);

          const { mergeConfig, loadConfigFromFile, searchForWorkspaceRoot } =
            await import('vite');

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

    const ctExecutorOptions = readTargetOptions<CypressExecutorOptions>(
      {
        project: ctProjectName,
        target: ctTargetName,
        configuration: ctConfigurationName,
      },
      ctExecutorContext
    );

    const buildTarget = ctExecutorOptions.devServerTarget;

    if (!buildTarget) {
      throw new Error(
        `Unable to find the 'devServerTarget' executor option in the '${ctTargetName}' target of the '${ctProjectName}' project`
      );
    }

    webpackConfig = buildTargetWebpack(graph, buildTarget, ctProjectName);
  } catch (e) {
    logger.warn(
      stripIndents`Unable to build a webpack config with the project graph. 
      Falling back to default webpack config.`
    );
    logger.warn(e);

    const { buildBaseWebpackConfig } = require('./webpack-fallback');
    webpackConfig = buildBaseWebpackConfig({
      tsConfigPath: findTsConfig(normalizedProjectRootPath),
      compiler: 'babel',
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
  options.generateIndexHtml ??= true;
  return options;
}

function buildTargetWebpack(
  graph: ProjectGraph,
  buildTarget: string,
  componentTestingProjectName: string
) {
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
    resolveCustomWebpackConfig,
  } = require('@nx/webpack/src/utils/webpack/custom-webpack');
  const {
    getWebpackConfig,
  } = require('@nx/webpack/src/executors/webpack/lib/get-webpack-config');

  const options = normalizeOptions(
    withSchemaDefaults(parsed, context),
    workspaceRoot,
    buildableProjectConfig.root!,
    buildableProjectConfig.sourceRoot!
  );

  let customWebpack: any;

  if (options.webpackConfig) {
    customWebpack = resolveCustomWebpackConfig(
      options.webpackConfig,
      options.tsConfig
    );
  }

  return async () => {
    customWebpack = await customWebpack;
    // TODO(jack): Once webpackConfig is always set in @nx/webpack:webpack, we no longer need this default.
    const defaultWebpack = getWebpackConfig(context, {
      ...options,
      // cypress will generate its own index.html from component-index.html
      generateIndexHtml: false,
      // causes issues with buildable libraries with ENOENT: no such file or directory, scandir error
      extractLicenses: false,
      root: workspaceRoot,
      projectRoot: ctProjectConfig.root,
      sourceRoot: ctProjectConfig.sourceRoot,
    });

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
