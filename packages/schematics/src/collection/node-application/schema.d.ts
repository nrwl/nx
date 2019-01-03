import { UnitTestRunner } from '../../utils/test-runners';
export interface Schema {
  name: string;
  skipFormat: boolean;
  skipPackageJson: boolean;
  framework: 'express' | 'none' | 'nestjs';
  directory?: string;
  unitTestRunner: UnitTestRunner;
  tags?: string;
}
