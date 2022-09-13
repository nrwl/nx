import {
  createExecutorContext,
  getProjectConfigByPath,
  nxBaseCypressPreset,
  NxComponentTestingOptions,
} from '@nrwl/cypress/plugins/cypress-preset';
import type { CypressExecutorOptions } from '@nrwl/cypress/src/executors/cypress/cypress.impl';
import {
  ExecutorContext,
  logger,
  parseTargetString,
  ProjectGraph,
  readCachedProjectGraph,
  readTargetOptions,
  stripIndents,
  Target,
  workspaceRoot,
} from '@nrwl/devkit';
import type { WebpackExecutorOptions } from '@nrwl/webpack/src/executors/webpack/schema';
import { normalizeOptions } from '@nrwl/webpack/src/executors/webpack/lib/normalize-options';
import { getWebpackConfig } from '@nrwl/webpack/src/executors/webpack/lib/get-webpack-config';
import { resolveCustomWebpackConfig } from '@nrwl/webpack/src/utils/webpack/custom-webpack';
import { buildBaseWebpackConfig } from './webpack-fallback';

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
) {
  let webpackConfig;
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
    webpackConfig = buildBaseWebpackConfig({
      tsConfigPath: 'tsconfig.cy.json',
      compiler: 'babel',
    });
  }
  return {
    ...nxBaseCypressPreset(pathToConfig),
    devServer: {
      // cypress uses string union type,
      // need to use const to prevent typing to string
      framework: 'react',
      bundler: 'webpack',
      webpackConfig,
    } as const,
  };
}

/**
 * apply the schema.json defaults from the @nrwl/web:webpack executor to the target options
 */
function withSchemaDefaults(
  target: Target,
  context: ExecutorContext
): WebpackExecutorOptions {
  const options = readTargetOptions<WebpackExecutorOptions>(target, context);

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
  const parsed = parseTargetString(buildTarget);

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

  const options = normalizeOptions(
    withSchemaDefaults(parsed, context),
    workspaceRoot,
    buildableProjectConfig.sourceRoot!
  );

  const isScriptOptimizeOn =
    typeof options.optimization === 'boolean'
      ? options.optimization
      : options.optimization && options.optimization.scripts
      ? options.optimization.scripts
      : false;

  let customWebpack;
  if (options.webpackConfig) {
    customWebpack = resolveCustomWebpackConfig(
      options.webpackConfig,
      options.tsConfig
    );

    if (typeof customWebpack.then === 'function') {
      // cypress configs have to be sync.
      // TODO(caleb): there might be a workaround with setUpNodeEvents preprocessor?
      logger.warn(stripIndents`Nx React Component Testing Preset currently doesn't support custom async webpack configs. 
      Skipping the custom webpack config option '${options.webpackConfig}'`);
      customWebpack = null;
    }
  }

  const defaultWebpack = getWebpackConfig(
    context,
    options,
    true,
    isScriptOptimizeOn,
    {
      root: ctProjectConfig.root,
      sourceRoot: ctProjectConfig.sourceRoot,
      configuration: parsed.configuration,
    }
  );

  if (customWebpack) {
    return customWebpack(defaultWebpack, {
      options,
      context,
      configuration: parsed.configuration,
    });
  }
  return defaultWebpack;
}
