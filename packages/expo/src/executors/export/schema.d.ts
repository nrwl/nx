// options form https://github.com/expo/expo/blob/main/packages/%40expo/cli/src/export/resolveOptions.ts
export interface ExportExecutorSchema {
  platform?: 'ios' | 'android' | 'all' | 'web'; // default is 'all'
  outputDir?: string;
  clear?: boolean;
  dev?: boolean;
  maxWorkers?: number;
  dumpAssetmap?: boolean;
  dumpSourcemap?: boolean;
  bundler: 'metro' | 'webpack';
}
