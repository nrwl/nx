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
  return async () => config;
}

// Both import forms exist in generated configs and copied production configs.
module.exports = withNx;
module.exports.withNx = withNx;
export { withNx };
