import { ProjectGraph } from '@nx/devkit';
import { AssetGlob } from '@nx/js/src/utils/assets/assets';

export interface AssetGlobPattern {
  glob: string;
  input: string;
  output: string;
  ignore?: string[];
}

export interface ExtraEntryPointClass {
  bundleName?: string;
  inject?: boolean;
  input: string;
  lazy?: boolean;
}

export interface FileReplacement {
  replace: string;
  with: string;
}

export interface AdditionalEntryPoint {
  entryName: string;
  entryPath: string;
}

export interface TransformerPlugin {
  name: string;
  options: Record<string, unknown>;
}

export type TransformerEntry = string | TransformerPlugin;

export interface OptimizationOptions {
  scripts: boolean;
  styles: boolean;
}

export interface NxAppWebpackPluginOptions {
  /**
   * The tsconfig file for the project. e.g. `tsconfig.json`
   */
  tsConfig?: string;
  /**
   * The entry point for the bundle. e.g. `src/main.ts`
   */
  main?: string;
  /**
   * Secondary entry points for the bundle.
   */
  additionalEntryPoints?: AdditionalEntryPoint[];
  /**
   * Assets to be copied over to the output path.
   */
  assets?: Array<AssetGlob | string>;
  /**
   * Babel configuration file if compiler is babel.
   */
  babelConfig?: string;
  /**
   * If true, Babel will look for a babel.config.json up the directory tree.
   */
  babelUpwardRootMode?: boolean;
  /**
   * Set <base href> for the resulting index.html.
   */
  baseHref?: string;
  /**
   * Build the libraries from source. Default is `true`.
   */
  buildLibsFromSource?: boolean;

  commonChunk?: boolean;
  /**
   * The compiler to use. Default is `babel` and requires a `.babelrc` file.
   */
  compiler?: 'babel' | 'swc' | 'tsc';
  /**
   * Set `crossorigin` attribute on the `script` and `link` tags.
   */
  crossOrigin?: 'none' | 'anonymous' | 'use-credentials';
  /**
   * Delete the output path before building.
   */
  deleteOutputPath?: boolean;
  /**
   * The deploy path for the application. e.g. `/my-app/`
   */
  deployUrl?: string;
  /**
   * Define external packages that will not be bundled.
   * Use `all` to exclude all 3rd party packages, and `none` to bundle all packages.
   * Use an array to exclude specific packages from the bundle.
   * Default is `none`.
   */
  externalDependencies?: 'all' | 'none' | string[];
  /**
   * Extract CSS as an external file. Default is `true`.
   */
  extractCss?: boolean;
  /**
   * Extract licenses from 3rd party modules and add them to the output.
   */
  extractLicenses?: boolean;
  /**
   * Replace files at build time. e.g. `[{ "replace": "src/a.dev.ts", "with": "src/a.prod.ts" }]`
   */
  fileReplacements?: FileReplacement[];
  /**
   * Generate an `index.html` file if `index.html` is passed. Default is `true`
   */
  generateIndexHtml?: boolean;
  /**
   * Generate a `package.json` file for the bundle. Useful for Node applications.
   */
  generatePackageJson?: boolean;
  /**
   * Path to the `index.html`.
   */
  index?: string;
  /**
   * Set the memory limit for the type-checking process. Default is `2048`.
   */
  memoryLimit?: number;
  /**
   * Use the source file name in output chunks. Useful for development or for Node.
   */
  namedChunks?: boolean;
  /**
   * Optimize the bundle using Terser.
   */
  optimization?: boolean | OptimizationOptions;
  /**
   * Specify the output filename for the bundle. Useful for Node applications that use `@nx/js:node` to serve.
   */
  outputFileName?: string;
  /**
   * Use file hashes in the output filenames. Recommended for production web applications.
   */
  outputHashing?: any;
  /**
   * Override `output.path` in webpack configuration. This setting is not recommended and exists for backwards compatibility.
   */
  outputPath?: string;
  /**
   * Override `watchOptions.poll` in webpack configuration. This setting is not recommended and exists for backwards compatibility.
   */
  poll?: number;
  /**
   * The polyfill file to use. Useful for supporting legacy browsers. e.g. `src/polyfills.ts`
   */
  polyfills?: string;
  /**
   * Manually set the PostCSS configuration file. By default, PostCSS will look for `postcss.config.js` in the directory.
   */
  postcssConfig?: string;
  /**
   * Display build progress in the terminal.
   */
  progress?: boolean;
  /**
   * Add an additional chunk for the Webpack runtime. Defaults to `true` when `target === 'web'`.
   */
  runtimeChunk?: boolean;
  /**
   * External scripts that will be included before the main application entry.
   */
  scripts?: Array<ExtraEntryPointClass | string>;
  /**
   * Skip type checking. Default is `false`.
   */
  skipTypeChecking?: boolean;
  /**
   * Generate source maps.
   */
  sourceMap?: boolean | 'hidden';
  /**
   * When `true`, `process.env.NODE_ENV` will be excluded from the bundle. Useful for building a web application to run in a Node environment.
   */
  ssr?: boolean;
  /**
   * Generate a `stats.json` file which can be analyzed using tools such as `webpack-bundle-analyzer`.
   */
  statsJson?: boolean;
  /**
   * Options for the style preprocessor. e.g. `{ "includePaths": [] }` for SASS.
   */
  stylePreprocessorOptions?: any;
  /**
   * External stylesheets that will be included with the application.
   */
  styles?: Array<ExtraEntryPointClass | string>;
  /**
   * Enables the use of subresource integrity validation.
   */
  subresourceIntegrity?: boolean;
  /**
   * Override the `target` option in webpack configuration. This setting is not recommended and exists for backwards compatibility.
   */
  target?: string | string[];
  /**
   * List of TypeScript Compiler Transformers Plugins.
   */
  transformers?: TransformerEntry[];
  /**
   * Generate a separate vendor chunk for 3rd party packages.
   */
  vendorChunk?: boolean;
  /**
   * Log additional information for debugging purposes.
   */
  verbose?: boolean;
  /**
   * Watch for file changes.
   */
  watch?: boolean;
  /**
   * Set a public path for assets resources with absolute paths.
   */
  publicPath?: string;
  /**
   * Whether to rebase absolute path for assets in postcss cli resources.
   */
  rebaseRootRelative?: boolean;
}

export interface NormalizedNxAppWebpackPluginOptions
  extends NxAppWebpackPluginOptions {
  projectName: string;
  root: string;
  projectRoot: string;
  sourceRoot: string;
  configurationName: string;
  targetName: string;
  projectGraph: ProjectGraph;
  outputFileName: string;
  assets: AssetGlobPattern[];
}
