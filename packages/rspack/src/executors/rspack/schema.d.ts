import type { Mode } from '@rspack/core';
export interface RspackExecutorSchema {
  target: 'web' | 'node';
  main: string;
  tsConfig: string;
  typeCheck?: boolean;
  outputPath: string;
  outputFileName?: string;
  indexHtml?: string;
  mode?: Mode;
  watch?: boolean;

  rspackConfig: string;
  optimization?: boolean;
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
