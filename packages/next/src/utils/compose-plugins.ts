import type { NextConfig } from 'next';
import type {
  NextConfigFn,
  NextPlugin,
  NextPluginThatReturnsConfigFn,
} from './config';

/** @deprecated Removed in Nx v24. This inert stub only keeps old configs loadable. */
export function composePlugins(
  ..._plugins: (NextPlugin | NextPluginThatReturnsConfigFn)[]
): (baseConfig: NextConfig) => NextConfigFn {
  return (baseConfig) => async (phase: string) => {
    const { PHASE_PRODUCTION_SERVER } = require('next/constants');
    // Copied into production builds, so only resolve the warning on Nx task runs.
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
    return baseConfig;
  };
}
