import { UnitTestRunner } from '../../utils/test-runners';
import { Framework } from '../../utils/framework';

export interface Schema {
  name: string;
  skipFormat: boolean;
  simpleModuleName: boolean;
  directory?: string;
  sourceDir?: string;
  publishable: boolean;
  module: boolean;

  spec?: boolean;
  flat?: boolean;
  commonModule?: boolean;

  style?: string;
  prefix?: string;
  routing?: boolean;
  lazy?: boolean;
  parentModule?: string;
  tags?: string;

  framework: Framework;

  unitTestRunner: UnitTestRunner;
}
