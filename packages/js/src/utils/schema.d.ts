import type { AssetGlob, FileInputOutput } from './assets/assets';
import { TransformerEntry } from './typescript/types';

export type Compiler = 'tsc' | 'swc';

export interface ExecutorOptions {
  assets: Array<AssetGlob | string>;
  main: string;
  rootDir?: string;
  outputPath: string;
  tsConfig: string;
  generateExportsField?: boolean;
  additionalEntryPoints?: string[];
  swcrc?: string;
  watch: boolean;
  clean?: boolean;
  transformers: TransformerEntry[];
  generateLockfile?: boolean;
  stripLeadingPaths?: boolean;
  generatePackageJson?: boolean;
  includeIgnoredAssetFiles?: boolean;
}

export interface NormalizedExecutorOptions extends ExecutorOptions {
  rootDir: string;
  projectRoot: string;
  mainOutputPath: string;
  generatePackageJson: boolean;
  files: Array<FileInputOutput>;
  root?: string;
  sourceRoot?: string;
}

export interface SwcExecutorOptions extends ExecutorOptions {
  skipTypeCheck?: boolean;
  /**
   * @deprecated
   */
  swcExclude?: string[];
}

export interface SwcCliOptions {
  srcPath: string;
  destPath: string;
  swcrcPath: string;
  swcCwd: string;
  stripLeadingPaths: boolean;
}

export interface NormalizedSwcExecutorOptions
  extends NormalizedExecutorOptions {
  originalProjectRoot: string;
  swcExclude: string[];
  skipTypeCheck: boolean;
  swcCliOptions: SwcCliOptions;
  tmpSwcrcPath: string;
  isTsSolutionSetup: boolean;
  sourceRoot?: string;
}
