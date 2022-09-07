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
import type { WebWebpackExecutorOptions } from '@nrwl/web/src/executors/webpack/webpack.impl';
import { normalizeWebBuildOptions } from '@nrwl/web/src/utils/normalize';
import { getWebConfig } from '@nrwl/web/src/utils/web.config';
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
): WebWebpackExecutorOptions {
  const options = readTargetOptions<WebWebpackExecutorOptions>(target, context);

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

  const options = normalizeWebBuildOptions(
    withSchemaDefaults(
      parsed,
      createExecutorContext(
        graph,
        buildableProjectConfig.targets,
        parsed.project,
        parsed.target,
        parsed.target
      )
    ),
    workspaceRoot,
    buildableProjectConfig.sourceRoot!
  );

  const isScriptOptimizeOn =
    typeof options.optimization === 'boolean'
      ? options.optimization
      : options.optimization && options.optimization.scripts
      ? options.optimization.scripts
      : false;
  return getWebConfig(
    workspaceRoot,
    ctProjectConfig.root,
    ctProjectConfig.sourceRoot,
    options,
    true,
    isScriptOptimizeOn,
    parsed.configuration
  );
}
