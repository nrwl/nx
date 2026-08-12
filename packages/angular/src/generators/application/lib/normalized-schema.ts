import { E2eTestRunner, UnitTestRunner } from '../../../utils/test-runners';
import type { Schema } from '../schema';
import { LinterType } from '@nx/js';
import { NxCloudOnBoardingStatus } from '@nx/devkit/internal';

export interface NormalizedSchema extends Schema {
  linter: LinterType;
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
