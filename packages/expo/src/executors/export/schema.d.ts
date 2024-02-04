// options form https://github.com/expo/expo/blob/main/packages/%40expo/cli/src/export/resolveOptions.ts
// https://github.com/expo/expo/blob/main/packages/%40expo/cli/src/export/index.ts

export interface ExportExecutorSchema {
  platform?: 'ios' | 'android' | 'all' | 'web'; // default is 'all'
  outputDir?: string;
  clear?: boolean;
  dev?: boolean;
  minify?: boolean;
  maxWorkers?: number;
  dumpAssetmap?: boolean;
  sourcemap?: boolean;
}
