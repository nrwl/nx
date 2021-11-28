import { Linter } from '@nrwl/linter';

export interface Schema {
  name: string;
  displayName?: string;
  style?: string;
  skipFormat: boolean; // default is false
  directory?: string;
  tags?: string;
  unitTestRunner: 'jest' | 'none'; // default is jest
  pascalCaseFiles?: boolean;
  classComponent?: boolean;
  js: boolean; // default is false
  linter: Linter; // default is eslint
  setParserOptionsProject?: boolean; // default is false
  e2eTestRunner: 'detox' | 'none'; // default is detox
}
