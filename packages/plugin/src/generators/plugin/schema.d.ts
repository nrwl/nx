import { Linter } from '@nx/linter';

export interface Schema {
  name: string;
  directory?: string;
  importPath?: string;
  skipTsConfig?: boolean; // default is false
  skipFormat?: boolean; // default is false
  skipLintChecks?: boolean; // default is false
  e2eTestRunner?: 'jest' | 'none';
  tags?: string;
  unitTestRunner: 'jest' | 'none';
  linter: Linter;
  setParserOptionsProject?: boolean;
  compiler: 'swc' | 'tsc';
  rootProject?: boolean;
  publishable?: boolean;
}
