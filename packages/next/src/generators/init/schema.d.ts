import type { ProjectNameAndRootFormat } from '@nx/devkit/src/generators/project-name-and-root-utils';

export interface InitSchema {
  unitTestRunner?: 'jest' | 'none';
  e2eTestRunner?: 'cypress' | 'playwright' | 'none';
  skipFormat?: boolean;
  js?: boolean;
  skipPackageJson?: boolean;
  rootProject?: boolean;
  projectNameAndRootFormat?: ProjectNameAndRootFormat;
}
