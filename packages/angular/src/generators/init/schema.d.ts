import type { ProjectNameAndRootFormat } from '@nx/devkit/src/generators/project-name-and-root-utils';
import type { Linter } from '@nx/linter';
import type { E2eTestRunner, UnitTestRunner } from '../../utils/test-runners';
import type { Styles } from '../utils/types';

export interface Schema {
  unitTestRunner?: UnitTestRunner;
  e2eTestRunner?: E2eTestRunner;
  skipFormat?: boolean;
  skipInstall?: boolean;
  style?: Styles;
  linter?: Linter;
  skipPackageJson?: boolean;
  rootProject?: boolean;
  projectNameAndRootFormat?: ProjectNameAndRootFormat;
}
