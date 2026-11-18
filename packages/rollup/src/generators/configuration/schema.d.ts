export interface RollupProjectSchema {
  project: string;
  main?: string;
  tsConfig?: string;
  compiler?: 'babel' | 'swc' | 'tsc';
  skipFormat?: boolean;
  skipPackageJson?: boolean;
  skipValidation?: boolean;
  importPath?: string;
  external?: string[];
  rollupConfig?: string;
  buildTarget?: string;
  format?: ('cjs' | 'esm')[];
}
