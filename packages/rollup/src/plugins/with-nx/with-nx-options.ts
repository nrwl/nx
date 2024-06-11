// TODO: Add TSDoc
export interface RollupWithNxPluginOptions {
  additionalEntryPoints?: string[];
  allowJs?: boolean;
  assets?: any[];
  babelUpwardRootMode?: boolean;
  compiler?: 'babel' | 'tsc' | 'swc';
  deleteOutputPath?: boolean;
  external?: string[] | 'all' | 'none';
  extractCss?: boolean | string;
  format?: ('cjs' | 'esm')[];
  generateExportsField?: boolean;
  javascriptEnabled?: boolean;
  main: string;
  /** @deprecated Do not set this. The package.json file in project root is detected automatically. */
  project?: string;
  outputFileName?: string;
  outputPath: string;
  rollupConfig?: string | string[];
  skipTypeCheck?: boolean;
  skipTypeField?: boolean;
  tsConfig: string;
}

export interface AssetGlobPattern {
  glob: string;
  ignore?: string[];
  input: string;
  output: string;
}

export interface NormalizedRollupWithNxPluginOptions
  extends RollupWithNxPluginOptions {
  assets: AssetGlobPattern[];
  compiler: 'babel' | 'tsc' | 'swc';
  format: ('cjs' | 'esm')[];
}
