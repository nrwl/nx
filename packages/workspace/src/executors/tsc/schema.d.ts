export interface TypeScriptExecutorOptions {
  assets: Array<AssetGlob | string>;
  main: string;
  outputPath: string;
  tsConfig: string;
}
