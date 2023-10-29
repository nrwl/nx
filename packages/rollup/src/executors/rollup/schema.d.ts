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
  deleteOutputPath?: boolean;
  format?: ('cjs' | 'esm')[];
  compiler?: 'babel' | 'tsc' | 'swc';
  javascriptEnabled?: boolean;
  generateExportsField?: boolean;
  additionalEntryPoints?: string[];
  skipTypeCheck?: boolean;
  babelUpwardRootMode?: boolean;
  skipTypeField?: boolean;
}
