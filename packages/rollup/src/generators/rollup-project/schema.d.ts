export interface RollupProjectSchema {
  project: string;
  main?: string;
  tsConfig?: string;
  compiler?: 'babel' | 'swc' | 'tsc';
  devServer?: boolean;
  skipFormat?: boolean;
  skipPackageJson?: boolean;
  importPath?: string;
  external?: string[];
  rollupConfig?: string;
}
