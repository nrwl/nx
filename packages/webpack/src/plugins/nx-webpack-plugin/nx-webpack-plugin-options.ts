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

export interface NxWebpackPluginOptions {
  // Required options
  main: string;
  outputPath: string;
  tsConfig: string;

  // Optional options
  additionalEntryPoints?: AdditionalEntryPoint[];
  assets?: Array<AssetGlob | string>;
  babelConfig?: string;
  babelUpwardRootMode?: boolean;
  baseHref?: string;
  commonChunk?: boolean;
  compiler?: 'babel' | 'swc' | 'tsc';
  crossOrigin?: 'none' | 'anonymous' | 'use-credentials';
  deleteOutputPath?: boolean;
  deployUrl?: string;
  externalDependencies?: 'all' | 'none' | string[];
  extractCss?: boolean;
  extractLicenses?: boolean;
  fileReplacements?: FileReplacement[];
  generateIndexHtml?: boolean;
  generatePackageJson?: boolean;
  index?: string;
  memoryLimit?: number;
  namedChunks?: boolean;
  optimization?: boolean | OptimizationOptions;
  outputFileName?: string;
  outputHashing?: any;
  poll?: number;
  polyfills?: string;
  postcssConfig?: string;
  progress?: boolean;
  runtimeChunk?: boolean;
  scripts?: Array<ExtraEntryPointClass | string>;
  skipTypeChecking?: boolean;
  sourceMap?: boolean | 'hidden';
  ssr?: boolean;
  statsJson?: boolean;
  stylePreprocessorOptions?: any;
  styles?: Array<ExtraEntryPointClass | string>;
  subresourceIntegrity?: boolean;
  target?: string | string[];
  transformers?: TransformerEntry[];
  vendorChunk?: boolean;
  verbose?: boolean;
  watch?: boolean;
}

export interface NormalizedNxWebpackPluginOptions
  extends NxWebpackPluginOptions {
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
