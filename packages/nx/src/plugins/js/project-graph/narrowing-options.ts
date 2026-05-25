import type { NxJsonConfiguration } from '../../../config/nx-json';
import type { BundlerKind } from './types';

export type DependencyNarrowingOptions = {
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

export type NormalizedDependencyNarrowingOptions = {
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

const DEFAULT_OPTIONS: NormalizedDependencyNarrowingOptions = {
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

export function normalizeDependencyNarrowingOptions(
  options?: DependencyNarrowingOptions
): NormalizedDependencyNarrowingOptions {
  return {
    ...DEFAULT_OPTIONS,
    ...options,
    bundlerAdapters:
      options?.bundlerAdapters && options.bundlerAdapters.length > 0
        ? options.bundlerAdapters
        : DEFAULT_OPTIONS.bundlerAdapters,
  };
}

export function getJsPluginDependencyNarrowingOptions(
  nxJson: NxJsonConfiguration | undefined
): NormalizedDependencyNarrowingOptions | undefined {
  const dependencyNarrowing =
    nxJson?.pluginsConfig?.['@nx/js']?.dependencyNarrowing;

  if (!dependencyNarrowing) {
    return undefined;
  }

  return normalizeDependencyNarrowingOptions(dependencyNarrowing);
}
