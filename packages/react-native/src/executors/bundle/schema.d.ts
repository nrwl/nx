export interface ReactNativeBundleOptions {
  dev: boolean;
  platform: string;
  entryFile: string;
  bundleOutput: string;
  maxWorkers: number;
  sourceMap: boolean;
}
