import { E2eTestRunner, UnitTestRunner } from '../../utils/test-runners';
import { Linter } from '@nrwl/workspace';

export interface Schema {
  unitTestRunner: UnitTestRunner;
  e2eTestRunner?: E2eTestRunner;
  skipFormat: boolean;
  skipInstall?: boolean;
  style?: string;
  linter: Linter;
}
