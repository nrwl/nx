import { E2eTestRunner, UnitTestRunner } from '../../../utils/test-runners';
import type { AngularLinter, Schema } from '../schema';

export interface NormalizedSchema extends Schema {
  linter: AngularLinter;
  unitTestRunner: UnitTestRunner;
  e2eTestRunner: E2eTestRunner;
  prefix: string;
  appProjectRoot: string;
  e2eProjectName: string;
  e2eProjectRoot: string;
  parsedTags: string[];
}
