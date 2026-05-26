import type { RawProjectGraphDependency } from '../../../project-graph/project-graph-builder';

export type RawDependency = RawProjectGraphDependency;

export type BundlerKind =
  | 'esbuild'
  | 'swc'
  | 'babel'
  | 'webpack'
  | 'rollup'
  | 'vite';

export type ImportInsight = {
  matched: boolean;
  removable: boolean;
  hasDynamicImport: boolean;
  onlyReexports: boolean;
  reexportedNames: string[];
  isStarReexport: boolean;
  namespaceAccessedProps?: Set<string>;
};

export type TargetMatchData = {
  target: string;
  root: string;
  packageName?: string;
  aliases: string[];
  sideEffects: boolean;
};
