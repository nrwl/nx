import { E2eTestRunner } from '../../utils/test-runners';
import { UnitTestRunner } from '../../utils/UnitTestRunner';
import { Linter } from '@nrwl/workspace';

export interface Schema {
  name: string;
  skipFormat: boolean;
  inlineStyle?: boolean;
  inlineTemplate?: boolean;
  viewEncapsulation?: 'Emulated' | 'Native' | 'None';
  routing?: boolean;
  enableIvy?: boolean;
  prefix?: string;
  style?: string;
  skipTests?: boolean;
  directory?: string;
  tags?: string;
  linter: Linter;
  unitTestRunner: UnitTestRunner;
  e2eTestRunner: E2eTestRunner;
  backendProject?: string;
  strict?: boolean;
}
