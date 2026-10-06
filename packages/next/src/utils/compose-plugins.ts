import type { NextConfig } from 'next';
import type {
  NextConfigFn,
  NextPlugin,
  NextPluginThatReturnsConfigFn,
} from './config';

export function composePlugins(
  ...plugins: (NextPlugin | NextPluginThatReturnsConfigFn)[]
): (baseConfig: NextConfig) => NextConfigFn {
  return function (baseConfig: NextConfig) {
    return async function combined(
      phase: string,
      context: any
    ): Promise<NextConfig> {
      const {
        PHASE_PRODUCTION_SERVER,
      }: typeof import('next/constants') = require('next/constants');
      // Copied verbatim into the build output (see create-next-config-file.ts),
      // so this must load without @nx/next or @nx/devkit installed. Warn only on
      // the active Nx-task path, resolved from the workspace like with-nx.ts.
      if (
        phase !== PHASE_PRODUCTION_SERVER &&
        !global.NX_GRAPH_CREATION &&
        process.env.NX_TASK_TARGET_TARGET
      ) {
        const { workspaceRoot } = require('@nx/devkit');
        const { warnComposePluginsDeprecation } = require(
          require.resolve('@nx/next/src/utils/deprecation', {
            paths: [workspaceRoot],
          })
        ) as typeof import('./deprecation');
        warnComposePluginsDeprecation(phase);
      }
      let config = baseConfig;
      for (const plugin of plugins) {
        const fn = await plugin;
        const configOrFn = fn(config);
        if (typeof configOrFn === 'function') {
          config = await configOrFn(phase, context);
        } else {
          config = configOrFn;
        }
      }

      return config;
    };
  };
}
