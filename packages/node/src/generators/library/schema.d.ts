import { Linter } from '@nx/linter';

export interface Schema {
  name: string;
  directory?: string;
  simpleModuleName?: boolean;
  skipTsConfig?: boolean;
  skipFormat?: boolean;
  tags?: string;
  unitTestRunner?: 'jest' | 'none';
  linter?: Linter;
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
}
