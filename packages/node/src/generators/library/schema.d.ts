import type { Linter, LinterType } from '@nx/eslint';

export interface Schema {
  directory: string;
  name?: string;
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
  strict?: boolean;
  standaloneConfig?: boolean;
  setParserOptionsProject?: boolean;
  compiler: 'tsc' | 'swc';
  addPlugin?: boolean;
  useProjectJson?: boolean;
}
