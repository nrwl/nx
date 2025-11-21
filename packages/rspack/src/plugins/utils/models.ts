import type { DevTool, Mode } from '@rspack/core';
import type { ProjectGraph } from '@nx/devkit';
import type { AssetGlob } from '@nx/js/src/utils/assets/assets';

/**
 * @deprecated SVGR support is deprecated and will be removed in Nx 23.
 * TODO(v23): Remove SVGR support
 */
export interface SvgrOptions {
  svgo?: boolean;
  titleProp?: boolean;
  ref?: boolean;
}

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

export interface NxAppRspackPluginOptions {
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
   * Set <base href> for the resulting index.html.
   */
  baseHref?: string | false;
  /**
   * Build the libraries from source. Default is `true`.
   */
  buildLibsFromSource?: boolean;

  commonChunk?: boolean;

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
   * Mode to run the build in.
   */
  mode?: Mode;
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
   * Override `output.path` in rspack configuration. This setting is not recommended and exists for backwards compatibility.
   */
  outputPath?: string;
  /**
   * Override `watchOptions.poll` in rspack configuration. This setting is not recommended and exists for backwards compatibility.
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
   * Add an additional chunk for the rspack runtime. Defaults to `true` when `target === 'web'`.
   */
  runtimeChunk?: boolean;
  /**
   * External scripts that will be included before the main application entry.
   */
  scripts?: Array<ExtraEntryPointClass | string>;
  /**
   * Do not add a `overrides` and `resolutions` entries to the generated package.json file. Only works in conjunction with `generatePackageJson` option.
   */
  skipOverrides?: boolean;
  /**
   * Do not add a `packageManager` entry to the generated package.json file. Only works in conjunction with `generatePackageJson` option.
   */
  skipPackageManager?: boolean;
  /**
   * Skip type checking. Default is `false`.
   */
  skipTypeChecking?: boolean;
  /**
   * Skip type checking. Default is `false`.
   */
  typeCheck?: boolean;
  /**
   * Generate source maps.
   */
  sourceMap?: boolean | DevTool;
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
  stylePreprocessorOptions?: {
    includePaths?: string[];
    sassOptions?: Record<string, any>;
    lessOptions?: Record<string, any>;
  };
  /**
   * External stylesheets that will be included with the application.
   */
  styles?: Array<ExtraEntryPointClass | string>;
  /**
   * Enables the use of subresource integrity validation.
   */
  subresourceIntegrity?: boolean;
  /**
   * Override the `target` option in rspack configuration. This setting is not recommended and exists for backwards compatibility.
   */
  target?: string | string[];
  /**
   * List of TypeScript Compiler Transformers Plugins.
   */
  transformers?: TransformerEntry[];
  /**
   * Use tsconfig-paths-webpack-plugin to resolve modules using paths in the tsconfig file.
   */
  useTsconfigPaths?: boolean;
  /**
   * Allows to overwrite the parameters used in the template. When using a function, pass in the original template parameters and use the returned object as the final template parameters.
   */
  templateParameters?:
    | Record<string, string>
    | boolean
    | ((
        params: Record<string, any>
      ) => Record<string, any> | Promise<Record<string, any>>);
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
  /**
   * Use the legacy WriteIndexHtmlPlugin instead of the built-in HtmlRspackPlugin.
   */
  useLegacyHtmlPlugin?: boolean;
}

export interface NormalizedNxAppRspackPluginOptions
  extends NxAppRspackPluginOptions {
  projectName: string;
  root: string;
  projectRoot: string;
  sourceRoot: string;
  configurationName: string;
  targetName: string;
  projectGraph: ProjectGraph;
  outputFileName: string;
  assets: AssetGlobPattern[];
  useLegacyHtmlPlugin: boolean;
}
