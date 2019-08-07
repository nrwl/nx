import { UnitTestRunner } from '../../utils/test-runners';

export interface Schema {
  name: string;
  skipFormat: boolean;
  simpleModuleName: boolean;
  directory?: string;
  sourceDir?: string;
  publishable: boolean;

  spec?: boolean;
  flat?: boolean;
  commonModule?: boolean;

  style?: string;
  prefix?: string;
  routing?: boolean;
  lazy?: boolean;
  parentModule?: string;
  tags?: string;

  unitTestRunner: UnitTestRunner;
}
