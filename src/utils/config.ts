import type { ExecutorContext } from '@nx/devkit';
import type { Configuration } from '@rspack/core';

import { SharedConfigContext } from './model';

export const nxRspackComposablePlugin = 'nxRspackComposablePlugin';

export function isNxRspackComposablePlugin(
  a: unknown
): a is AsyncNxComposableRspackPlugin {
  return a?.[nxRspackComposablePlugin] === true;
}

export interface NxRspackExecutionContext {
  options: unknown;
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

export function composePlugins(...plugins: any[]) {
  return Object.defineProperty(
    async function combined(
      config: Configuration,
      ctx: SharedConfigContext
    ): Promise<Configuration> {
      for (const plugin of plugins) {
        const fn = await plugin;
        config = await fn(config, ctx);
      }
      return config;
    },
    nxRspackComposablePlugin,
    {
      value: true,
      enumerable: false,
      writable: false,
    }
  );
}
