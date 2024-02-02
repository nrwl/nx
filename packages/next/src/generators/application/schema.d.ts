import type { ProjectNameAndRootFormat } from '@nx/devkit/src/generators/project-name-and-root-utils';
import type { Linter } from '@nx/eslint';
import type { SupportedStyles } from '@nx/react';

export interface Schema {
  name: string;
  style?: SupportedStyles;
  skipFormat?: boolean;
  directory?: string;
  projectNameAndRootFormat?: ProjectNameAndRootFormat;
  tags?: string;
  unitTestRunner?: 'jest' | 'none';
  e2eTestRunner?: 'cypress' | 'playwright' | 'none';
  linter?: Linter;
  js?: boolean;
  setParserOptionsProject?: boolean;
  swc?: boolean;
  customServer?: boolean;
  skipPackageJson?: boolean;
  appDir?: boolean;
  src?: boolean;
  rootProject?: boolean;
  addPlugin?: boolean;
}
