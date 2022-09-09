import { AssetGlob } from '@nrwl/workspace/src/utilities/assets';
import { CrossOriginValue } from '../../utils/webpack/write-index-html';

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
export interface WebpackExecutorOptions {
  assets?: Array<AssetGlob | string>;
  baseHref?: string;
  budgets?: any[];
  buildLibsFromSource?: boolean;
  commonChunk?: boolean;
  compiler?: 'babel' | 'swc';
  crossOrigin?: CrossOriginValue;
  deleteOutputPath?: boolean;
  deployUrl?: string;
  es2015Polyfills?: string;
  extractCss?: boolean;
  extractLicenses?: boolean;
  fileReplacements?: FileReplacement[];
  generateIndexHtml?: boolean;
  index?: string;
  main: string;
  maxWorkers?: number;
  memoryLimit?: number;
  namedChunks?: boolean;
  optimization?: boolean | OptimizationOptions;
  outputHashing?: any;
  outputPath: string;
  poll?: number;
  polyfills?: string;
  postcssConfig?: string;
  progress?: boolean;
  runtimeChunk?: boolean;
  scripts?: Array<ExtraEntryPointClass | string>;
  sourceMap?: boolean | 'hidden';
  statsJson?: boolean;
  stylePreprocessorOptions?: any;
  styles?: Array<ExtraEntryPointClass | string>;
  subresourceIntegrity?: boolean;
  target?: 'node' | 'web';
  tsConfig: string;
  vendorChunk?: boolean;
  verbose?: boolean;
  watch?: boolean;
  webpackConfig?: string;
}

export interface NormalizedWebpackExecutorOptions
  extends WebpackExecutorOptions {
  assets?: AssetGlobPattern[];
  root?: string;
  sourceRoot?: string;
}
