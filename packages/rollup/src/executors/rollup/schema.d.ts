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
  /**
   * @deprecated Configure the project to use the `@nx/dependency-checks` ESLint
   * rule instead (https://nx.dev/packages/eslint-plugin/documents/dependency-checks).
   * It will be removed in v17.
   */
  updateBuildableProjectDepsInPackageJson?: boolean;
  /**
   * @deprecated Configure the project to use the `@nx/dependency-checks` ESLint
   * rule instead (https://nx.dev/packages/eslint-plugin/documents/dependency-checks).
   * It will be removed in v17.
   */
  buildableProjectDepsInPackageJsonType?: 'dependencies' | 'peerDependencies';
  deleteOutputPath?: boolean;
  format?: ('cjs' | 'esm')[];
  compiler?: 'babel' | 'tsc' | 'swc';
  javascriptEnabled?: boolean;
  generateExportsField?: boolean;
  skipTypeCheck?: boolean;
  babelUpwardRootMode?: boolean;
  skipTypeField?: boolean;
}
