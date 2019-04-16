import { E2eTestRunner, UnitTestRunner } from '../../utils/test-runners';

export interface Schema {
  name: string;
  prefix?: string;
  style?: string;
  skipFormat: boolean;
  directory?: string;
  tags?: string;
  unitTestRunner: UnitTestRunner;
  e2eTestRunner: E2eTestRunner;
}
