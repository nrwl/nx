import { Linter } from '@nrwl/workspace/src/utils/lint';

export interface Schema {
  name: string;
  directory?: string;
  skipTsConfig: boolean;
  skipFormat: boolean;
  tags?: string;
  simpleModuleName: boolean;
  unitTestRunner: 'jest' | 'none';
  linter: Linter;
  testEnvironment: 'jsdom' | 'node';
  importPath?: string;
  js: boolean;
  babelJest?: boolean;
  pascalCaseFiles: boolean;
  strict: boolean;
}
