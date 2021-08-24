import { Linter } from '@nrwl/linter';

export interface Schema {
  name: string;
  skipFormat?: boolean;
  skipPackageJson?: boolean;
  directory?: string;
  unitTestRunner?: 'jest' | 'none';
  linter?: Linter;
  tags?: string;
  frontendProject?: string;
  babelJest?: boolean;
  js?: boolean;
  pascalCaseFiles?: boolean;
  setParserOptionsProject?: boolean;
  standaloneConfig?: boolean;
  experimentalSwc?: boolean;
}
