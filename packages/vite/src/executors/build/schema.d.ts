import type { FileReplacement } from '../../plugins/rollup-replace-files.plugin';
export interface ViteBuildExecutorOptions {
  outputPath: string;
  base?: string;
  configFile?: string;
  fileReplacements?: FileReplacement[];
  sourcemap?: boolean | 'inline' | 'hidden';
  minify?: boolean | 'esbuild' | 'terser';
  manifest?: boolean | string;
  ssrManifest?: boolean | string;
  logLevel?: 'info' | 'warn' | 'error' | 'silent';
  mode?: string;
}
