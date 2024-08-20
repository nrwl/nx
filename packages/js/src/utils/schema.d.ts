import type { ProjectNameAndRootFormat } from '@nx/devkit/src/generators/project-name-and-root-utils';
import type { AssetGlob, FileInputOutput } from './assets/assets';
import { TransformerEntry } from './typescript/types';
// nx-ignore-next-line
const { Linter, LinterType } = require('@nx/eslint'); // use require to import to avoid circular dependency

export type Compiler = 'tsc' | 'swc';
export type Bundler = 'swc' | 'tsc' | 'rollup' | 'vite' | 'esbuild' | 'none';

export interface LibraryGeneratorSchema {
  name: string;
  directory?: string;
  projectNameAndRootFormat?: ProjectNameAndRootFormat;
  skipFormat?: boolean;
  tags?: string;
  skipTsConfig?: boolean;
  skipPackageJson?: boolean;
  includeBabelRc?: boolean;
  unitTestRunner?: 'jest' | 'vitest' | 'none';
  linter?: Linter | LinterType;
  testEnvironment?: 'jsdom' | 'node';
  importPath?: string;
  js?: boolean;
  pascalCaseFiles?: boolean;
  strict?: boolean;
  publishable?: boolean;
  buildable?: boolean;
  setParserOptionsProject?: boolean;
  config?: 'workspace' | 'project' | 'npm-scripts';
  compiler?: Compiler;
  bundler?: Bundler;
  skipTypeCheck?: boolean;
  minimal?: boolean;
  rootProject?: boolean;
  simpleName?: boolean;
  addPlugin?: boolean;
}

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
  external?: 'all' | 'none' | string[];
  externalBuildTargets?: string[];
  generateLockfile?: boolean;
  stripLeadingPaths?: boolean;
}

export interface NormalizedExecutorOptions extends ExecutorOptions {
  rootDir: string;
  projectRoot: string;
  mainOutputPath: string;
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
  sourceRoot?: string;
  // TODO(v20): remove inline feature
  inline?: boolean;
}
