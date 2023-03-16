import type { Mode } from '@rspack/core';
export interface RspackExecutorSchema {
  target: 'web' | 'node';
  main: string;
  tsConfig: string;
  outputPath: string;
  indexHtml?: string;
  mode?: Mode;

  rspackConfig: string;
  optimization?: boolean;
  sourceMap?: boolean | string;
  assets?: any[];
}
