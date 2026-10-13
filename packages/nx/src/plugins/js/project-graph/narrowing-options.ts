import type { NxJsonConfiguration } from '../../../config/nx-json';
import type { BundlerKind } from './types';

export type DependencyNarrowingOptions = {
  mode?: 'semantic' | 'strict' | 'aggressive';
  concurrency?: number;
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
  concurrency: number;
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
  concurrency: 50,
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

export type NormalizedOptions = NormalizedDependencyNarrowingOptions;

export function normalizeDependencyNarrowingOptions(
  options?: DependencyNarrowingOptions
): NormalizedDependencyNarrowingOptions {
  return {
    ...DEFAULT_OPTIONS,
    ...options,
    concurrency: normalizeConcurrency(options?.concurrency),
    bundlerAdapters:
      options?.bundlerAdapters && options.bundlerAdapters.length > 0
        ? options.bundlerAdapters
        : DEFAULT_OPTIONS.bundlerAdapters,
  };
}

function normalizeConcurrency(concurrency: number | undefined): number {
  if (!Number.isFinite(concurrency) || concurrency === undefined) {
    return DEFAULT_OPTIONS.concurrency;
  }

  const normalized = Math.floor(concurrency);
  return normalized > 0 ? normalized : DEFAULT_OPTIONS.concurrency;
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
