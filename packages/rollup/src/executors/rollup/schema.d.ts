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
  allowJs?: boolean;
  project: string;
  main: string;
  outputFileName?: string;
  extractCss?: boolean | string;
  external?: string[] | 'all' | 'none';
  rollupConfig?: string | string[];
  watch?: boolean;
  assets?: any[];
  updateBuildableProjectDepsInPackageJson?: boolean;
  buildableProjectDepsInPackageJsonType?: 'dependencies' | 'peerDependencies';
  deleteOutputPath?: boolean;
  format?: string[];
  compiler?: 'babel' | 'tsc' | 'swc';
  javascriptEnabled?: boolean;
  generateExportsField?: boolean;
  skipTypeCheck?: boolean;
  babelUpwardRootMode?: boolean;
  skipTypeField?: boolean;
}
