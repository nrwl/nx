import { E2eTestRunner, UnitTestRunner } from '../../utils/test-runners';

export interface Schema {
  name: string;
  skipFormat: boolean;
  inlineStyle?: boolean;
  inlineTemplate?: boolean;
  viewEncapsulation?: 'Emulated' | 'Native' | 'None';
  routing?: boolean;
  prefix?: string;
  style?: string;
  skipTests?: boolean;
  directory?: string;
  tags?: string;
  unitTestRunner: UnitTestRunner;
  e2eTestRunner: E2eTestRunner;
}
