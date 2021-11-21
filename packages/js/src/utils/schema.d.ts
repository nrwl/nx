// nx-ignore-next-line
const { Linter } = require('@nrwl/linter');
import type {
  AssetGlob,
  FileInputOutput,
} from '@nrwl/workspace/src/utilities/assets';

export type Compiler = 'tsc' | 'swc';

export interface GeneratorSchema {
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
  buildable?: boolean;
  setParserOptionsProject?: boolean;
  config?: 'workspace' | 'project' | 'npm-scripts';
  compiler?: Compiler;
}

export interface ExecutorOptions {
  assets: Array<AssetGlob | string>;
  main: string;
  outputPath: string;
  tsConfig: string;
}

export interface NormalizedExecutorOptions extends ExecutorOptions {
  files: Array<FileInputOutput>;
}
