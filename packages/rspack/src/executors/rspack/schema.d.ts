import type { DevTool, Mode } from '@rspack/core';

export interface RspackExecutorSchema {
  additionalEntryPoints?: AdditionalEntryPoint[];
  assets?: Array<AssetGlobPattern | string>;
  baseHref?: string;
  buildLibsFromSource?: boolean;
  deployUrl?: string;
  extractCss?: boolean;
  extractLicenses?: boolean;
  externalDependencies?: 'all' | 'none' | string[];
  fileReplacements?: FileReplacement[];
  generateIndexHtml?: boolean;
  generatePackageJson?: boolean;
  index?: string;
  indexHtml?: string;
  main?: string;
  memoryLimit?: number;
  mode?: Mode;
  namedChunks?: boolean;
  optimization?: boolean | OptimizationOptions;
  outputFileName?: string;
  outputHashing?: any;
  outputPath?: string;
  poll?: number;
  polyfills?: string;
  postcssConfig?: string;
  progress?: boolean;
  publicPath?: string;
  rebaseRootRelative?: boolean;
  rspackConfig?: string;
  runtimeChunk?: boolean;
  scripts?: Array<ExtraEntryPointClass | string>;
  skipTypeChecking?: boolean;
  sourceMap?: boolean | DevTool;
  standardRspackConfigFunction?: boolean;
  statsJson?: boolean;
  stylePreprocessorOptions?: {
    includePaths?: string[];
    sassOptions?: Record<string, any>;
    lessOptions?: Record<string, any>;
  };
  styles?: Array<ExtraEntryPointClass | string>;
  target?: 'web' | 'node';
  transformers?: TransformerEntry[];
  tsConfig?: string;
  typeCheck?: boolean;
  verbose?: boolean;
  vendorChunk?: boolean;
  watch?: boolean;
}

export interface AssetGlobPattern {
  glob: string;
  input: string;
  output: string;
  ignore?: string[];
}

export interface FileReplacement {
  replace: string;
  with: string;
}

export interface OptimizationOptions {
  scripts: boolean;
  styles: boolean;
}

export interface NormalizedRspackExecutorSchema extends RspackExecutorSchema {
  outputFileName: string;
  assets: AssetGlobPattern[];
  root: string;
  projectRoot: string;
  sourceRoot: string;
  useTsconfigPaths: boolean;
}
