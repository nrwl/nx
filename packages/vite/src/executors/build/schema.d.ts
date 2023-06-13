import type { FileReplacement } from '../../plugins/rollup-replace-files.plugin';
export interface ViteBuildExecutorOptions {
  outputPath: string;
  emptyOutDir?: boolean;
  base?: string;
  configFile?: string;
  fileReplacements?: FileReplacement[];
  force?: boolean;
  sourcemap?: boolean | 'inline' | 'hidden';
  minify?: boolean | 'esbuild' | 'terser';
  manifest?: boolean | string;
  ssrManifest?: boolean | string;
  logLevel?: 'info' | 'warn' | 'error' | 'silent';
  mode?: string;
  ssr?: boolean | string;
  watch?: object | boolean;
  target?: string | string[];
  generatePackageJson?: boolean;
  includeDevDependenciesInPackageJson?: boolean;
  cssCodeSplit?: boolean;
  buildLibsFromSource?: boolean;
  skipTypeCheck?: boolean;
}
