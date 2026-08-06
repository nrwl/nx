export interface TsdownExecutorSchema {
  entry?: string | string[];
  outDir?: string;
  format?: ('esm' | 'cjs' | 'iife')[];
  dts?: boolean;
  sourcemap?: boolean;
  clean?: boolean;
  tsconfig?: string;
  external?: string[];
  skipNodeModulesBundle?: boolean;
  minify?: boolean;
  target?: string;
  platform?: 'node' | 'browser' | 'neutral';
  globalName?: string;
  shims?: boolean;
  onSuccess?: string;
  configFile?: string;
  watch?: boolean;
  outputPath?: string;
}
