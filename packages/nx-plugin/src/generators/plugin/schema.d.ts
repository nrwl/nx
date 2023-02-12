import { Linter } from '@nrwl/linter';

export interface Schema {
  name: string;
  directory?: string;
  importPath?: string;
  skipTsConfig: boolean;
  skipFormat: boolean;
  skipLintChecks: boolean;
  e2eTestRunner?: 'jest' | 'none';
  tags?: string;
  unitTestRunner: 'jest' | 'none';
  linter: Linter;
  setParserOptionsProject?: boolean;
  compiler: 'swc' | 'tsc';
  minimal?: boolean;
}
