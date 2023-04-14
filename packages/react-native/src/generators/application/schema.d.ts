import { Linter } from '@nx/linter';

export interface Schema {
  name: string;
  displayName?: string;
  style?: string;
  skipFormat?: boolean;
  directory?: string;
  tags?: string;
  unitTestRunner?: 'jest' | 'none';
  pascalCaseFiles?: boolean;
  classComponent?: boolean;
  js?: boolean;
  linter?: Linter;
  setParserOptionsProject?: boolean;
  e2eTestRunner?: 'detox' | 'none';
  install: boolean; // default is true
  skipPackageJson?: boolean; //default is false
}
