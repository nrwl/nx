import type { FileReplacement } from '../../plugins/rollup-replace-files.plugin';
export interface ViteBuildExecutorOptions {
  outputPath: string;
  base?: string;
  buildableProjectDepsInPackageJsonType?: 'dependencies' | 'peerDependencies';
  configFile?: string;
  emptyOutDir?: boolean;
  excludeLibsInPackageJson?: boolean;
  fileReplacements?: FileReplacement[];
  force?: boolean;
  format?: 'esm' | 'cjs';
  generateLockfile?: boolean;
  generatePackageJson?: boolean;
  logLevel?: 'info' | 'warn' | 'error' | 'silent';
  main?: string;
  manifest?: boolean | string;
  minify?: boolean | 'esbuild' | 'terser';
  mode?: string;
  sourcemap?: boolean | 'inline' | 'hidden';
  ssr?: boolean | string;
  ssrManifest?: boolean | string;
  tsConfig?: string;
  watch?: object | boolean;
}
