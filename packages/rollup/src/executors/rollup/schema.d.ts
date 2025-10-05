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
  main: string;
  additionalEntryPoints?: string[];
  allowJs?: boolean;
  assets?: any[];
  babelUpwardRootMode?: boolean;
  buildLibsFromSource?: boolean;
  compiler?: 'babel' | 'tsc' | 'swc';
  deleteOutputPath?: boolean;
  external?: string[] | 'all' | 'none';
  extractCss?: boolean | string;
  format?: ('cjs' | 'esm')[];
  generateExportsField?: boolean;
  javascriptEnabled?: boolean;
  project?: string;
  outputFileName?: string;
  rollupConfig?: string | string[];
  skipTypeCheck?: boolean;
  skipTypeField?: boolean;
  useLegacyTypescriptPlugin?: boolean;
  watch?: boolean;
}
