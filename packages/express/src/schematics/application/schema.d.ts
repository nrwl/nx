import { UnitTestRunner } from '../../utils/test-runners';
import { Linter } from '@nrwl/workspace';

export interface Schema {
  name: string;
  skipFormat: boolean;
  skipPackageJson: boolean;
  directory?: string;
  unitTestRunner: UnitTestRunner;
  tags?: string;
  linter: Linter;
  frontendProject?: string;
  babelJest?: boolean;
  js: boolean;
  pascalCaseFiles: boolean;
}
