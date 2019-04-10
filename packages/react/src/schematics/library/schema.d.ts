import { UnitTestRunner } from '../../utils/test-runners';
import { Framework } from '../../utils/framework';

export interface Schema {
  name: string;
  directory?: string;
  style?: string;
  skipTsConfig: boolean;
  skipFormat: boolean;
  tags?: string;
  simpleModuleName: boolean;

  unitTestRunner: UnitTestRunner;
}
