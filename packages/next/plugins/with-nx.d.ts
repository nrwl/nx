/**
 * WARNING: Do not add development dependencies to top-level imports.
 * Instead, `require` them inline during the build phase.
 */
import type { NextConfig } from 'next';
import type { NextConfigFn } from '../src/utils/config';
import { type ProjectGraphProjectNode } from '@nx/devkit';
import type { AssetGlobPattern } from '@nx/webpack';
export interface WithNxOptions extends NextConfig {
  nx?: {
    babelUpwardRootMode?: boolean;
    fileReplacements?: {
      replace: string;
      with: string;
    }[];
    assets?: AssetGlobPattern[];
  };
}
export interface WithNxContext {
  workspaceRoot: string;
  libsDir: string;
}
/**
 * Try to read output dir from project, and default to '.next' if executing outside of Nx (e.g. dist is added to a docker image).
 */
declare function withNx(
  _nextConfig?: WithNxOptions,
  context?: WithNxContext
): NextConfigFn;
export declare function getNextConfig(
  nextConfig?: WithNxOptions,
  context?: WithNxContext
): NextConfig;
export declare function getAliasForProject(
  node: ProjectGraphProjectNode,
  paths: Record<string, string[]>
): null | string;
export declare function forNextVersion(range: string, fn: () => void): void;
export { withNx };
//# sourceMappingURL=with-nx.d.ts.map
