import type { Linter, LinterType } from '@nx/eslint';
import type { UnitTestRunner } from '../../utils/test-runners';

export interface Schema {
  directory: string;
  name?: string;
  skipFormat: boolean;
  skipPackageJson: boolean;
  unitTestRunner: UnitTestRunner;
  tags?: string;
  linter: Linter | LinterType;
  frontendProject?: string;
  swcJest?: boolean;
  /** @deprecated use `swcJest` instead */
  babelJest?: boolean;
  js: boolean;
  enableTypedLinting?: boolean;
  /**
   * @deprecated The `setParserOptionsProject` option is deprecated and will be removed in Nx v24. Use `enableTypedLinting` instead.
   */
  setParserOptionsProject?: boolean;
  addPlugin?: boolean;
  useProjectJson?: boolean;
  keepExistingVersions?: boolean;
}
