type Compiler = 'babel' | 'swc';

export interface Globals {
  moduleId: string;
  global: string;
}

export interface WebRollupOptions {
  outputPath: string;
  tsConfig: string;
  project: string;
  entryFile: string;
  extractCss?: boolean;
  globals?: Globals[];
  external?: string[];
  rollupConfig?: string | string[];
  watch?: boolean;
  assets?: any[];
  updateBuildableProjectDepsInPackageJson?: boolean;
  buildableProjectDepsInPackageJsonType?: 'dependencies' | 'peerDependencies';
  umdName?: string;
  deleteOutputPath?: boolean;
  format: string[];
  compiler?: Compiler;
}
