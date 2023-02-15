export interface RspackExecutorSchema {
  target: 'web' | 'node';
  main: string;
  tsConfig: string;
  outputPath: string;
  indexHtml?: string;

  rspackConfig: string;
  optimization?: boolean;
  sourceMap?: boolean | string;
  assets?: any[];
}
