export interface RollupWithNxPluginOptions {
  /**
   * Additional entry-points to add to exports field in the package.json file.
   * */
  additionalEntryPoints?: string[];
  /**
   * Allow JavaScript files to be compiled.
   */
  allowJs?: boolean;
  /**
   * List of static assets.
   */
  assets?: any[];
  /**
   * Whether to set rootmode to upward. See https://babeljs.io/docs/en/options#rootmode
   */
  babelUpwardRootMode?: boolean;
  /**
   * Which compiler to use.
   */
  compiler?: 'babel' | 'tsc' | 'swc';
  /**
   * Delete the output path before building. Defaults to true.
   */
  deleteOutputPath?: boolean;
  /**
   * A list of external modules that will not be bundled (`react`, `react-dom`, etc.). Can also be set to `all` (bundle nothing) or `none` (bundle everything).
   */
  external?: string[] | 'all' | 'none';
  /**
   * CSS files will be extracted to the output folder. Alternatively custom filename can be provided (e.g. styles.css)
   */
  extractCss?: boolean | string;
  /**
   * List of module formats to output. Defaults to matching format from tsconfig (e.g. CJS for CommonJS, and ESM otherwise).
   */
  format?: ('cjs' | 'esm')[];
  /**
   * Update the output package.json file's 'exports' field. This field is used by Node and bundles.
   */
  generateExportsField?: boolean;
  /**
   * Sets `javascriptEnabled` option for less loader
   */
  javascriptEnabled?: boolean;
  /**
   * The path to the entry file, relative to project.
   */
  main: string;
  /**
   * The path to package.json file.
   * @deprecated Do not set this. The package.json file in project root is detected automatically.
   */
  project?: string;
  /**
   * Name of the main output file. Defaults same basename as 'main' file.
   */
  outputFileName?: string;
  /**
   * The output path of the generated files.
   */
  outputPath: string;
  /**
   * Whether to skip TypeScript type checking.
   */
  skipTypeCheck?: boolean;
  /**
   * Prevents 'type' field from being added to compiled package.json file. Use this if you are having an issue with this field.
   */
  skipTypeField?: boolean;
  /**
   * The path to tsconfig file.
   */
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
