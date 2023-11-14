import { E2eTestRunner, UnitTestRunner } from '../../../utils/test-runners';
import type { Schema } from '../schema';
import { Linter } from '@nx/eslint';

export interface NormalizedSchema extends Schema {
  linter: Linter;
  unitTestRunner: UnitTestRunner;
  e2eTestRunner: E2eTestRunner;
  prefix: string;
  appProjectRoot: string;
  appProjectSourceRoot: string;
  e2eProjectName: string;
  e2eProjectRoot: string;
  parsedTags: string[];
  outputPath: string;
}
