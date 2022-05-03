// nx-ignore-next-line
const { Linter } = require('@nrwl/linter');
import type {
  AssetGlob,
  FileInputOutput,
} from '@nrwl/workspace/src/utilities/assets';
import { TransformerEntry } from './typescript/types';

export type Compiler = 'tsc' | 'swc';

export interface LibraryGeneratorSchema {
  name: string;
  directory?: string;
  skipFormat?: boolean;
  tags?: string;
  simpleModuleName?: boolean;
  skipTsConfig?: boolean;
  unitTestRunner?: 'jest' | 'none';
  linter?: Linter;
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
  skipTypeCheck?: boolean;
}

export interface ExecutorOptions {
  assets: Array<AssetGlob | string>;
  main: string;
  outputPath: string;
  tsConfig: string;
  swcrcPath: string;
  watch: boolean;
  transformers: TransformerEntry[];
  updateBuildableProjectDepsInPackageJson?: boolean;
  buildableProjectDepsInPackageJsonType?: 'dependencies' | 'peerDependencies';
}

export interface NormalizedExecutorOptions extends ExecutorOptions {
  root?: string;
  sourceRoot?: string;
  projectRoot?: string;
  mainOutputPath: string;
  files: Array<FileInputOutput>;
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
}

export interface NormalizedSwcExecutorOptions
  extends NormalizedExecutorOptions {
  swcExclude: string[];
  skipTypeCheck: boolean;
  swcCliOptions: SwcCliOptions;
}
