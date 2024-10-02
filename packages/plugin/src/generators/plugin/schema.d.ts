import type { Linter, LinterType } from '@nx/eslint';

export interface Schema {
  directory: string;
  name?: string;
  importPath?: string;
  skipTsConfig?: boolean; // default is false
  skipFormat?: boolean; // default is false
  skipLintChecks?: boolean; // default is false
  e2eTestRunner?: 'jest' | 'none';
  tags?: string;
  unitTestRunner: 'jest' | 'none';
  linter: Linter | LinterType;
  setParserOptionsProject?: boolean;
  compiler: 'swc' | 'tsc';
  rootProject?: boolean;
  publishable?: boolean;
}
