import { AssetGlob } from '@nrwl/workspace/src/utilities/assets';

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

export interface WebpackExecutorOptions {
  additionalEntryPoints?: AdditionalEntryPoint[];
  assets?: Array<AssetGlob | string>;
  buildLibsFromSource?: boolean;
  commonChunk?: boolean;
  compiler?: 'babel' | 'swc' | 'tsc';
  deleteOutputPath?: boolean;
  externalDependencies?: 'all' | 'none' | string[];
  extractLicenses?: boolean;
  fileReplacements?: FileReplacement[];
  generatePackageJson?: boolean;
  isolatedConfig?: boolean;
  main: string;
  memoryLimit?: number;
  namedChunks?: boolean;
  optimization?: boolean | OptimizationOptions;
  outputFileName?: string;
  outputHashing?: any;
  outputPath: string;
  poll?: number;
  polyfills?: string;
  progress?: boolean;
  runtimeChunk?: boolean;
  sourceMap?: boolean | 'hidden';
  statsJson?: boolean;
  target?: 'node' | 'web';
  transformers?: TransformerEntry[];
  tsConfig: string;
  vendorChunk?: boolean;
  verbose?: boolean;
  watch?: boolean;
  webpackConfig?: string;
  babelConfig?: string;
  babelUpwardRootMode?: boolean;
  // TODO(jack): Also deprecate these in schema.json once we have migration from executor options to webpack.config.js file.
  /** @deprecated Moved to withWeb options from `@nrwl/webpack` */
  baseHref?: string;
  /** @deprecated Moved to withWeb options from `@nrwl/webpack` */
  crossOrigin?: 'none' | 'anonymous' | 'use-credentials';
  /** @deprecated Moved to withWeb options from `@nrwl/webpack` */
  deployUrl?: string;
  /** @deprecated Moved to withWeb options from `@nrwl/webpack` */
  extractCss?: boolean;
  /** @deprecated Moved to withWeb options from `@nrwl/webpack` */
  generateIndexHtml?: boolean;
  /** @deprecated Moved to withWeb options from `@nrwl/webpack` */
  index?: string;
  /** @deprecated Moved to withWeb options from `@nrwl/webpack` */
  postcssConfig?: string;
  /** @deprecated Moved to withWeb options from `@nrwl/webpack` */
  scripts?: Array<ExtraEntryPointClass | string>;
  /** @deprecated Moved to withWeb options from `@nrwl/webpack` */
  stylePreprocessorOptions?: any;
  /** @deprecated Moved to withWeb options from `@nrwl/webpack` */
  styles?: Array<ExtraEntryPointClass | string>;
  /** @deprecated Moved to withWeb options from `@nrwl/webpack` */
  subresourceIntegrity?: boolean;
}

export interface NormalizedWebpackExecutorOptions
  extends WebpackExecutorOptions {
  outputFileName: string;
  assets?: AssetGlobPattern[];
  root?: string;
  projectRoot?: string;
  sourceRoot?: string;
}
