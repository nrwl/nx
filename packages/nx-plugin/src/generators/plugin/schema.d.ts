import { Linter } from '@nrwl/linter';

export interface Schema {
  name: string;
  directory?: string;
  importPath?: string;
  skipTsConfig: boolean;
  skipFormat: boolean;
  skipLintChecks: boolean;
  tags?: string;
  unitTestRunner: 'jest' | 'none';
  linter: Linter;
  standaloneConfig?: boolean;
  setParserOptionsProject?: boolean;
  compiler: 'swc' | 'tsc';
}
