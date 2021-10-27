import { UnitTestRunner } from '../../utils/test-runners';
import type { Linter } from '@nrwl/linter';

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
  standaloneConfig?: boolean;
  setParserOptionsProject?: boolean;
  experimentalSwc?: boolean;
}
