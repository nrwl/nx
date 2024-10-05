import {
  ExecutorContext,
  readCachedProjectGraph,
  readProjectsConfigurationFromProjectGraph,
  workspaceRoot,
} from '@nx/devkit';
import { Configuration } from 'webpack';

import { NormalizedWebpackExecutorOptions } from '../executors/webpack/schema';
import { readNxJson } from 'nx/src/config/configuration';

export const nxWebpackComposablePlugin = 'nxWebpackComposablePlugin';

export function isNxWebpackComposablePlugin(
  a: unknown
): a is AsyncNxComposableWebpackPlugin {
  return a?.[nxWebpackComposablePlugin] === true;
}

export interface NxWebpackExecutionContext {
  options: NormalizedWebpackExecutorOptions;
  context: ExecutorContext;
  configuration?: string;
}

export interface NxComposableWebpackPlugin {
  (config: Configuration, ctx: NxWebpackExecutionContext): Configuration;
}

export interface AsyncNxComposableWebpackPlugin {
  (config: Configuration, ctx: NxWebpackExecutionContext):
    | Configuration
    | Promise<Configuration>;
}

export function composePlugins(
  ...plugins: (
    | NxComposableWebpackPlugin
    | AsyncNxComposableWebpackPlugin
    | Promise<NxComposableWebpackPlugin | AsyncNxComposableWebpackPlugin>
  )[]
) {
  return Object.assign(
    async function combined(
      config: Configuration,
      ctx: NxWebpackExecutionContext
    ): Promise<Configuration> {
      // Webpack may be calling us as a standard config function.
      // Build up Nx context from environment variables.
      // This is to enable `@nx/webpack/plugin` to work with existing projects.
      if (ctx['env']) {
        ensureNxWebpackExecutionContext(ctx);
        // Build this from scratch since what webpack passes us is the env, not config,
        // and `withNX()` creates a new config object anyway.
        config = {};
      }

      for (const plugin of plugins) {
        const fn = await plugin;
        config = await fn(config, ctx);
      }
      return config;
    },
    {
      [nxWebpackComposablePlugin]: true,
    }
  );
}

export function composePluginsSync(...plugins: NxComposableWebpackPlugin[]) {
  return Object.assign(
    function combined(
      config: Configuration,
      ctx: NxWebpackExecutionContext
    ): Configuration {
      for (const plugin of plugins) {
        config = plugin(config, ctx);
      }
      return config;
    },
    {
      [nxWebpackComposablePlugin]: true,
    }
  );
}

function ensureNxWebpackExecutionContext(ctx: NxWebpackExecutionContext): void {
  const projectName = process.env.NX_TASK_TARGET_PROJECT;
  const targetName = process.env.NX_TASK_TARGET_TARGET;
  const configurationName = process.env.NX_TASK_TARGET_CONFIGURATION;
  const projectGraph = readCachedProjectGraph();
  const projectNode = projectGraph.nodes[projectName];
  ctx.options ??= {
    root: workspaceRoot,
    projectRoot: projectNode.data.root,
    sourceRoot: projectNode.data.sourceRoot ?? projectNode.data.root,
    // These aren't actually needed since NxWebpackPlugin and withNx both support them being undefined.
    assets: undefined,
    outputPath: undefined,
    tsConfig: undefined,
    outputFileName: undefined,
  };
  ctx.context ??= {
    projectName,
    targetName,
    configurationName,
    projectsConfigurations:
      readProjectsConfigurationFromProjectGraph(projectGraph),
    nxJsonConfiguration: readNxJson(workspaceRoot),
    cwd: process.cwd(),
    root: workspaceRoot,
    isVerbose: process.env['NX_VERBOSE_LOGGING'] === 'true',
    projectGraph,
  };
}
