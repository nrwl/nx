type Compiler = 'babel' | 'swc';

export interface AssetGlobPattern {
  glob: string;
  input: string;
  output: string;
  ignore?: string[];
}

export interface Globals {
  moduleId: string;
  global: string;
}

export interface RollupExecutorOptions {
  outputPath: string;
  tsConfig: string;
  project: string;
  main: string;
  outputFileName?: string;
  extractCss?: boolean | string;
  external?: string[];
  rollupConfig?: string | string[];
  watch?: boolean;
  assets?: any[];
  updateBuildableProjectDepsInPackageJson?: boolean;
  buildableProjectDepsInPackageJsonType?: 'dependencies' | 'peerDependencies';
  deleteOutputPath?: boolean;
  format?: string[];
  compiler?: 'babel' | 'tsc' | 'swc';
  javascriptEnabled?: boolean;
  // TODO(jack): remove this for Nx 16
  skipTypeField?: boolean;
  generateExportsField?: boolean;
}
