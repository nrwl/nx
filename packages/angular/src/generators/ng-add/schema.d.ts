import { Linter, LinterType } from '@nx/eslint';
import { E2eTestRunner, UnitTestRunner } from '../../utils/test-runners';
import type { Styles } from '../utils/types';

export interface GeneratorOptions {
  defaultBase?: string;

  unitTestRunner?: UnitTestRunner;
  e2eTestRunner?: E2eTestRunner;
  skipFormat?: boolean;
  skipInstall?: boolean;
  skipPostInstall?: boolean;
  style?: Styles;
  linter?: Linter | LinterType;
  skipPackageJson?: boolean;
}
