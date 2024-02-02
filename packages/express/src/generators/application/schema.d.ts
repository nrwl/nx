import type { ProjectNameAndRootFormat } from '@nx/devkit/src/generators/project-name-and-root-utils';
import type { Linter } from '@nx/eslint';
import type { UnitTestRunner } from '../../utils/test-runners';

export interface Schema {
  name: string;
  skipFormat: boolean;
  skipPackageJson: boolean;
  directory?: string;
  projectNameAndRootFormat?: ProjectNameAndRootFormat;
  unitTestRunner: UnitTestRunner;
  tags?: string;
  linter: Linter;
  frontendProject?: string;
  swcJest?: boolean;
  /** @deprecated use `swcJest` instead */
  babelJest?: boolean;
  js: boolean;
  pascalCaseFiles: boolean;
  standaloneConfig?: boolean;
  setParserOptionsProject?: boolean;
  addPlugin?: boolean;
}
