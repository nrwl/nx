import { Linter } from '@nrwl/workspace';

export interface Schema {
  name: string;
  directory?: string;
  style?: string;
  skipTsConfig: boolean;
  skipFormat: boolean;
  tags?: string;
  simpleModuleName: boolean;
  pascalCaseFiles?: boolean;
  routing?: boolean;
  parentRoute?: string;
  unitTestRunner: 'jest' | 'none';
  linter: Linter;
}
