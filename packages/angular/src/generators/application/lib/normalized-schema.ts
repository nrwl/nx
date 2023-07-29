import { E2eTestRunner, UnitTestRunner } from '../../../utils/test-runners';
import type { Schema } from '../schema';
import { Linter } from '@nx/linter';

export interface NormalizedSchema extends Schema {
  linter: Linter;
  unitTestRunner: UnitTestRunner;
  e2eTestRunner: E2eTestRunner;
  prefix: string;
  appProjectRoot: string;
  e2eProjectName: string;
  e2eProjectRoot: string;
  parsedTags: string[];
  ngCliSchematicAppRoot: string;
  ngCliSchematicE2ERoot: string;
}
