import { ExecutorContext, readCachedProjectGraph } from '@nx/devkit';
import { NxWebpackExecutionContext } from '../../utils/config';
import { NxAppWebpackPluginOptions } from '../nx-webpack-plugin/nx-app-webpack-plugin-options';
import { Configuration } from 'webpack';
import { normalizeOptions } from '../nx-webpack-plugin/lib/normalize-options';

/**
 * This function is used to wrap the legacy plugin function to be used with the `composePlugins` function.
 * Initially the webpack config would be passed to the legacy plugin function and the options would be passed as a second argument.
 * example:
 * module.exports = composePlugins(
      withNx(),
      (config) => {
        return config;
      }
  );
  
Since composePlugins is async, this function is used to wrap the legacy plugin function to be async.
Using the nxUseLegacyPlugin function, the first argument is the legacy plugin function and the second argument is the options.
The context options are created and passed to the legacy plugin function.

module.exports = async () => ({
  plugins: [
  ...otherPlugins,
    await nxUseLegacyPlugin(require({path}), options),
  ],
});
 * @param fn The legacy plugin function usually from `combinedPlugins`
 * @param executorOptions The options passed usually inside the executor or the config file
 * @returns Webpack configuration
 */
export async function useLegacyNxPlugin(
  fn: (
    config: Configuration,
    ctx: NxWebpackExecutionContext
  ) => Promise<Configuration>,
  executorOptions: NxAppWebpackPluginOptions
) {
  if (global.NX_GRAPH_CREATION) {
    return;
  }
  const options = normalizeOptions(executorOptions);

  const projectGraph = readCachedProjectGraph();
  const projectName = process.env.NX_TASK_TARGET_PROJECT;
  const project = projectGraph.nodes[projectName];
  const targetName = process.env.NX_TASK_TARGET_TARGET;

  const context: ExecutorContext = {
    cwd: process.cwd(),
    isVerbose: process.env.NX_VERBOSE_LOGGING === 'true',
    root: project.data.root,
    projectGraph: readCachedProjectGraph(),
    target: project.data.targets[targetName],
    targetName: targetName,
    projectName: projectName,
  };

  const configuration = process.env.NX_TASK_TARGET_CONFIGURATION;
  return async (config: Configuration) => {
    const ctx: NxWebpackExecutionContext = {
      context,
      options: options as NxWebpackExecutionContext['options'],
      configuration,
    };
    return await fn(config, ctx);
  };
}
