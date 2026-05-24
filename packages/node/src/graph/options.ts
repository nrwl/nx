import type { BundlerKind } from './types';

export type NodeTreeShakePluginOptions = {
  mode?: 'semantic' | 'strict' | 'aggressive';
  respectSideEffects?: boolean;
  removeTypeOnlyEdges?: boolean;
  treatMissingPackageJsonAsSideEffectFree?: boolean;
  resolveNamespaceImports?: boolean;
  bundlerAdapters?: BundlerKind[];
  fallbackToStaticGraph?: boolean;
  passthrough?: boolean;
  affectedNarrowing?: boolean;
  debug?: boolean;
};

export type NormalizedOptions = {
  mode: 'semantic' | 'strict' | 'aggressive';
  respectSideEffects: boolean;
  removeTypeOnlyEdges: boolean;
  treatMissingPackageJsonAsSideEffectFree: boolean;
  resolveNamespaceImports: boolean;
  bundlerAdapters: BundlerKind[];
  fallbackToStaticGraph: boolean;
  passthrough: boolean;
  affectedNarrowing: boolean;
  debug: boolean;
};

const DEFAULT_OPTIONS: NormalizedOptions = {
  mode: 'semantic',
  respectSideEffects: true,
  removeTypeOnlyEdges: true,
  treatMissingPackageJsonAsSideEffectFree: false,
  resolveNamespaceImports: false,
  bundlerAdapters: ['esbuild', 'swc', 'babel', 'webpack', 'rollup', 'vite'],
  fallbackToStaticGraph: true,
  passthrough: false,
  affectedNarrowing: true,
  debug: false,
};

export function normalizeOptions(
  options?: NodeTreeShakePluginOptions
): NormalizedOptions {
  return {
    ...DEFAULT_OPTIONS,
    ...options,
    bundlerAdapters:
      options?.bundlerAdapters && options.bundlerAdapters.length > 0
        ? options.bundlerAdapters
        : DEFAULT_OPTIONS.bundlerAdapters,
  };
}