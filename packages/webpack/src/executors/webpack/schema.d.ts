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

export interface WebpackExecutorOptions {
  additionalEntryPoints?: AdditionalEntryPoint[];
  assets?: Array<AssetGlob | string>;
  buildLibsFromSource?: boolean;
  commonChunk?: boolean;
  compiler?: 'babel' | 'swc' | 'tsc';
  externalDependencies?: 'all' | 'none' | string[];
  extractLicenses?: boolean;
  fileReplacements?: FileReplacement[];
  generatePackageJson?: boolean;
  standardWebpackConfigFunction?: boolean;
  main?: string;
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
  sourceMap?: boolean | string;
  statsJson?: boolean;
  target?: string;
  transformers?: TransformerEntry[];
  tsConfig?: string;
  vendorChunk?: boolean;
  verbose?: boolean;
  watch?: boolean;
  webpackConfig?: string;
  babelConfig?: string;
  babelUpwardRootMode?: boolean;
  baseHref?: string;
  crossOrigin?: 'none' | 'anonymous' | 'use-credentials';
  deployUrl?: string;
  extractCss?: boolean;
  generateIndexHtml?: boolean;
  index?: string;
  postcssConfig?: string;
  scripts?: Array<ExtraEntryPointClass | string>;
  stylePreprocessorOptions?: any;
  styles?: Array<ExtraEntryPointClass | string>;
  subresourceIntegrity?: boolean;
  publicPath?: string;
  rebaseRootRelative?: boolean;
}

export interface NormalizedWebpackExecutorOptions
  extends WebpackExecutorOptions {
  outputFileName: string;
  assets: AssetGlobPattern[];
  root: string;
  projectRoot: string;
  sourceRoot: string;
  useTsconfigPaths: boolean;
}
