import { UnitTestRunner } from '../../utils/test-runners';

export interface Schema {
  name: string;
  directory?: string;
  skipTsConfig: boolean;
  skipFormat: boolean;
  tags?: string;
  simpleModuleName: boolean;
  unitTestRunner: 'jest' | 'none';
  linter: 'eslint' | 'tslint';
}
