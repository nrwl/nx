// options form https://github.com/react-native-community/cli/blob/main/docs/commands.md#bundle
export interface ReactNativeBundleOptions {
  entryFile: string;
  platform: string;
  transfrom?: string;
  dev: boolean; // default is true
  minify?: boolean; // default is false, if dev is false, then minify will become true
  bundleOutput: string;
  maxWorkers: number;
  sourcemapOutput?: string;
  sourcemapSourcesRoot?: string;
  sourcemapUseAbsolutePath: boolean; // default is false
  assetDest?: string;
  resetCache: boolean; // default is false
  readGlobalCache?: boolean; // default is false
}
