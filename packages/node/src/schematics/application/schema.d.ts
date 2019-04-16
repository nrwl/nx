import { UnitTestRunner } from '../../utils/test-runners';
export interface Schema {
  name: string;
  skipFormat: boolean;
  skipPackageJson: boolean;
  directory?: string;
  unitTestRunner: UnitTestRunner;
  tags?: string;
  frontendProject?: string;
}
