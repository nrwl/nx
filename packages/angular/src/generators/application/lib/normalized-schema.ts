import { NxCloudOnBoardingStatus } from '@nx/devkit/internal';
import { E2eTestRunner, UnitTestRunner } from '../../../utils/test-runners';
import type { Schema } from '../schema';
import { Linter, LinterType } from '@nx/eslint';

export interface NormalizedSchema extends Schema {
  linter: Linter | LinterType;
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
