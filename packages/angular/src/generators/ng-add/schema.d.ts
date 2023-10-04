import { Linter } from '@nx/linter';
import { E2eTestRunner, UnitTestRunner } from '../../utils/test-runners';
import type { Styles } from '../utils/types';

export interface GeneratorOptions {
  /**
   * @deprecated This should be inferred with {@link getNpmScope}
   */
  npmScope?: string;
  defaultBase?: string;

  unitTestRunner?: UnitTestRunner;
  e2eTestRunner?: E2eTestRunner;
  skipFormat?: boolean;
  skipInstall?: boolean;
  skipPostInstall?: boolean;
  style?: Styles;
  linter?: Linter;
  skipPackageJson?: boolean;
}
