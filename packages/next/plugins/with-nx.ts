import type { NextConfig } from 'next';
import type { NextConfigFn } from '../src/utils/config';
import type { AssetGlobPattern } from '@nx/webpack';

export interface WithNxOptions extends NextConfig {
  nx?: {
    babelUpwardRootMode?: boolean;
    fileReplacements?: { replace: string; with: string }[];
    assets?: AssetGlobPattern[];
  };
}

export interface WithNxContext {
  workspaceRoot: string;
  libsDir: string;
}

/** @deprecated Removed in Nx v24. This inert stub only keeps old configs loadable. */
function withNx(
  config: WithNxOptions = {},
  _context?: WithNxContext
): NextConfigFn {
  return async (phase: string) => {
    const { PHASE_PRODUCTION_SERVER } = require('next/constants');
    // Copied into production builds, so only resolve the warning on Nx task runs.
    if (
      phase !== PHASE_PRODUCTION_SERVER &&
      !global.NX_GRAPH_CREATION &&
      process.env.NX_TASK_TARGET_TARGET
    ) {
      const { workspaceRoot } = require('@nx/devkit');
      const { warnWithNxDeprecation } = require(
        require.resolve('@nx/next/src/utils/deprecation', {
          paths: [workspaceRoot],
        })
      ) as typeof import('../src/utils/deprecation');
      warnWithNxDeprecation();
    }
    return config;
  };
}

/** @deprecated Removed in Nx v24. This inert stub only keeps old configs loadable. */
export function getNextConfig(
  nextConfig: WithNxOptions = {},
  _context?: WithNxContext
): NextConfig {
  return nextConfig;
}

/** @deprecated Removed in Nx v24. This inert stub only keeps old configs loadable. */
export function getAliasForProject(
  _node: unknown,
  _paths: Record<string, string[]>
): null | string {
  return null;
}

// Both import forms exist in generated configs and copied production configs.
module.exports = withNx;
module.exports.withNx = withNx;
module.exports.getNextConfig = getNextConfig;
module.exports.getAliasForProject = getAliasForProject;
export { withNx };
