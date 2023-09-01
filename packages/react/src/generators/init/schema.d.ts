import type { ProjectNameAndRootFormat } from '@nx/devkit/src/generators/project-name-and-root-utils';

export interface InitSchema {
  unitTestRunner?: 'jest' | 'vitest' | 'none';
  e2eTestRunner?: 'cypress' | 'playwright' | 'none';
  skipFormat?: boolean;
  skipPackageJson?: boolean;
  skipHelperLibs?: boolean;
  js?: boolean;
  rootProject?: boolean;
  projectNameAndRootFormat?: ProjectNameAndRootFormat;
}
