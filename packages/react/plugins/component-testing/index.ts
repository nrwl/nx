import { nxBaseCypressPreset } from '@nrwl/cypress/plugins/cypress-preset';
import {
  logger,
  parseTargetString,
  ProjectConfiguration,
  ProjectGraph,
  readCachedProjectGraph,
  TargetConfiguration,
  workspaceRoot,
  stripIndents,
} from '@nrwl/devkit';
import { WebWebpackExecutorOptions } from '@nrwl/web/src/executors/webpack/webpack.impl';
import { normalizeWebBuildOptions } from '@nrwl/web/src/utils/normalize';
import { getWebConfig } from '@nrwl/web/src/utils/web.config';
import { mapProjectGraphFiles } from '@nrwl/workspace/src/utils/runtime-lint-utils';
import { extname, relative } from 'path';
import { buildBaseWebpackConfig } from './webpack-fallback';

export interface ReactComponentTestingOptions {
  /**
   * the component testing target name.
   * this is only when customized away from the default value of `component-test`
   * @example 'component-test'
   */
  ctTargetName: string;
}

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
  options?: ReactComponentTestingOptions
) {
  let webpackConfig;
  try {
    const graph = readCachedProjectGraph();
    const { targets, name } = getConfigByPath(graph, pathToConfig);
    const targetName = options?.ctTargetName || 'component-test';
    const mergedOptions = targets[targetName].defaultConfiguration
      ? {
          ...targets[targetName].options,
          ...targets[targetName].configurations[
            targets[targetName].defaultConfiguration
          ],
        }
      : targets[targetName].options;
    const buildTarget = mergedOptions?.devServerTarget;

    if (!buildTarget) {
      throw new Error(
        `Unable to find the 'devServerTarget' executor option in the '${targetName}' target of the '${name}' project`
      );
    }

    webpackConfig = buildTargetWebpack(graph, buildTarget, name);
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
  target: TargetConfiguration<WebWebpackExecutorOptions>
) {
  const options = target.defaultConfiguration
    ? {
        ...target.options,
        ...target.configurations[target.defaultConfiguration],
      }
    : target.options;

  options.compiler = options.compiler || 'babel';
  options.deleteOutputPath = options.deleteOutputPath === undefined || true;
  options.vendorChunk = options.vendorChunk === undefined || true;
  options.commonChunk = options.commonChunk === undefined || true;
  options.runtimeChunk = options.runtimeChunk === undefined || true;
  options.sourceMap = options.sourceMap === undefined || true;
  options.assets = options.assets || [];
  options.scripts = options.scripts || [];
  options.styles = options.styles || [];
  options.budgets = options.budgets || [];
  options.namedChunks = options.namedChunks === undefined || true;
  options.outputhasing = options.outputhasing || 'none';
  options.extractCss = options.extractCss === undefined || true;
  options.memoryLimit = options.memoryLimit || 2048;
  options.maxWorkers = options.maxWorkers || 2;
  options.fileReplacements = options.fileReplacements || [];
  options.buildLibsFromSource =
    options.buildLibsFromSource === undefined || true;
  options.generateIndexHtml = options.generateIndexHtml === undefined || true;
  return options;
}

function buildTargetWebpack(
  graph: ProjectGraph,
  buildTarget: string,
  componentTestingProjectName: string
) {
  const { project, target, configuration } = parseTargetString(buildTarget);

  const appProjectConfig = graph.nodes[project]?.data;
  const thisProjectConfig = graph.nodes[componentTestingProjectName]?.data;

  if (!appProjectConfig || !thisProjectConfig) {
    throw new Error(stripIndents`Unable to load project configs from graph. 
    Has build config? ${!!appProjectConfig}
    Has component config? ${!!thisProjectConfig}
    `);
  }

  const options = normalizeWebBuildOptions(
    withSchemaDefaults(appProjectConfig?.targets?.[target]),
    workspaceRoot,
    appProjectConfig.sourceRoot!
  );

  const isScriptOptimizeOn =
    typeof options.optimization === 'boolean'
      ? options.optimization
      : options.optimization && options.optimization.scripts
      ? options.optimization.scripts
      : false;
  return getWebConfig(
    workspaceRoot,
    thisProjectConfig.root,
    thisProjectConfig.sourceRoot,
    options,
    true,
    isScriptOptimizeOn,
    configuration
  );
}

function getConfigByPath(
  graph: ProjectGraph,
  configPath: string
): ProjectConfiguration {
  const configFileFromWorkspaceRoot = relative(
    workspaceRoot,
    configPath
  ).replace(extname(configPath), '');
  const mappedGraph = mapProjectGraphFiles(graph);
  const componentTestingProjectName =
    mappedGraph.allFiles[configFileFromWorkspaceRoot];
  if (
    !componentTestingProjectName ||
    !graph.nodes[componentTestingProjectName]?.data
  ) {
    throw new Error(
      stripIndents`Unable to find the project configuration that includes ${configFileFromWorkspaceRoot}. 
      Found project name? ${componentTestingProjectName}. 
      Graph has data? ${!!graph.nodes[componentTestingProjectName]?.data}`
    );
  }
  // make sure name is set since it can be undefined
  graph.nodes[componentTestingProjectName].data.name =
    graph.nodes[componentTestingProjectName].data.name ||
    componentTestingProjectName;
  return graph.nodes[componentTestingProjectName].data;
}
