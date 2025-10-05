import {
  ExecutorContext,
  readCachedProjectGraph,
  readProjectsConfigurationFromProjectGraph,
  workspaceRoot,
} from '@nx/devkit';
import { getProjectSourceRoot } from '@nx/js/src/utils/typescript/ts-solution-setup';
import type { Configuration } from '@rspack/core';
import { readNxJson } from 'nx/src/config/configuration';
import { NormalizedRspackExecutorSchema } from '../executors/rspack/schema';

export const nxRspackComposablePlugin = 'nxRspackComposablePlugin';

export function isNxRspackComposablePlugin(
  a: unknown
): a is AsyncNxComposableRspackPlugin {
  return a?.[nxRspackComposablePlugin] === true;
}

export interface NxRspackExecutionContext {
  options: NormalizedRspackExecutorSchema;
  context: ExecutorContext;
  configuration?: string;
}

export interface NxComposableRspackPlugin {
  (config: Configuration, ctx: NxRspackExecutionContext): Configuration;
}

export interface AsyncNxComposableRspackPlugin {
  (config: Configuration, ctx: NxRspackExecutionContext):
    | Configuration
    | Promise<Configuration>;
}

export function composePlugins(
  ...plugins: (
    | NxComposableRspackPlugin
    | AsyncNxComposableRspackPlugin
    | Promise<NxComposableRspackPlugin | AsyncNxComposableRspackPlugin>
  )[]
) {
  return Object.assign(
    async function combined(
      config: Configuration,
      ctx: NxRspackExecutionContext
    ): Promise<Configuration> {
      // Rspack may be calling us as a standard config function.
      // Build up Nx context from environment variables.
      // This is to enable `@nx/rspack/plugin` to work with existing projects.
      if (ctx['env']) {
        ensureNxRspackExecutionContext(ctx);
        // Build this from scratch since what rspack passes us is the env, not config,
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
      [nxRspackComposablePlugin]: true,
    }
  );
}

export function composePluginsSync(...plugins: NxComposableRspackPlugin[]) {
  return Object.assign(
    function combined(
      config: Configuration,
      ctx: NxRspackExecutionContext
    ): Configuration {
      for (const plugin of plugins) {
        config = plugin(config, ctx);
      }
      return config;
    },
    {
      [nxRspackComposablePlugin]: true,
    }
  );
}

function ensureNxRspackExecutionContext(ctx: NxRspackExecutionContext): void {
  const projectName = process.env.NX_TASK_TARGET_PROJECT;
  const targetName = process.env.NX_TASK_TARGET_TARGET;
  const configurationName = process.env.NX_TASK_TARGET_CONFIGURATION;
  const projectGraph = readCachedProjectGraph();
  const projectNode = projectGraph.nodes[projectName];
  ctx.options ??= {
    root: workspaceRoot,
    projectRoot: projectNode.data.root,
    sourceRoot: getProjectSourceRoot(projectNode.data),
    // These aren't actually needed since NxRspackPlugin and withNx both support them being undefined.
    assets: undefined,
    outputFileName: undefined,
    outputPath: undefined,
    rspackConfig: undefined,
    useTsconfigPaths: undefined,
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
