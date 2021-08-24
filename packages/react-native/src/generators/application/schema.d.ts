import { Linter } from '@nrwl/linter';

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
}
