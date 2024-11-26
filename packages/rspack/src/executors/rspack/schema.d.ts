import type { Mode } from '@rspack/core';

export interface RspackExecutorSchema {
  target: 'web' | 'node';
  main: string;
  index?: string;
  tsConfig: string;
  typeCheck?: boolean;
  outputPath: string;
  outputFileName?: string;
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

export interface FileReplacement {
  replace: string;
  with: string;
}

export interface OptimizationOptions {
  scripts: boolean;
  styles: boolean;
}
