import type { Mode } from '@rspack/core';

export interface RspackExecutorSchema {
  target?: 'web' | 'node';
  main?: string;
  index?: string;
  tsConfig?: string;
  typeCheck?: boolean;
  skipTypeChecking?: boolean;
  outputPath?: string;
  outputFileName?: string;
  index?: string;
  indexHtml?: string;
  mode?: Mode;
  watch?: boolean;
  baseHref?: string;
  deployUrl?: string;

  rspackConfig: string;
  optimization?: boolean | OptimizationOptions;
  sourceMap?: boolean | string;
  assets?: any[];
  extractLicenses?: boolean;
  fileReplacements?: FileReplacement[];
  generatePackageJson?: boolean;
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
}
