import { UnitTestRunner } from '../../utils/test-runners';
export interface Schema {
  unitTestRunner: UnitTestRunner;
  e2eTestRunner: E2eTestRunner;
  skipFormat: boolean;
  skipInstall?: boolean;
}
