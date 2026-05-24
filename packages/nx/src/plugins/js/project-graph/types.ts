export type RawDependency = {
  source: string;
  target: string;
  type: string;
  sourceFile?: string;
};

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