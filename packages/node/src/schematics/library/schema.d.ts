import { Linter } from '@nrwl/workspace';

export interface Schema {
  name: string;
  directory?: string;
  skipTsConfig: boolean;
  skipFormat: boolean;
  tags?: string;
  unitTestRunner: 'jest' | 'none';
  linter: Linter;
  buildable?: boolean;
  publishable?: boolean;
  importPath?: string;
  testEnvironment: 'jsdom' | 'node';
  rootDir?: string;
  babelJest?: boolean;
  js: boolean;
  pascalCaseFiles: boolean;
  strict: boolean;
}
