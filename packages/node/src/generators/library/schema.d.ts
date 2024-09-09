import type { ProjectNameAndRootFormat } from '@nx/devkit/src/generators/project-name-and-root-utils';
import type { Linter, LinterType } from '@nx/eslint';

export interface Schema {
  name: string;
  directory?: string;
  projectNameAndRootFormat?: ProjectNameAndRootFormat;
  simpleModuleName?: boolean;
  skipTsConfig?: boolean;
  skipFormat?: boolean;
  tags?: string;
  unitTestRunner?: 'jest' | 'none';
  linter?: Linter | LinterType;
  buildable?: boolean;
  publishable?: boolean;
  importPath?: string;
  testEnvironment?: 'jsdom' | 'node';
  rootDir?: string;
  babelJest?: boolean;
  js?: boolean;
  pascalCaseFiles?: boolean;
  strict?: boolean;
  standaloneConfig?: boolean;
  setParserOptionsProject?: boolean;
  compiler: 'tsc' | 'swc';
  addPlugin?: boolean;
}
