// `LinterType` comes from `@nx/js`, which this package declares; `@nx/eslint`
// is not a dependency here, so importing it would resolve to a published
// tarball rather than workspace source.
import type { LinterType } from '@nx/js';
import type { UnitTestRunner } from '../../utils/test-runners';

export interface Schema {
  directory: string;
  name?: string;
  skipFormat: boolean;
  skipPackageJson: boolean;
  unitTestRunner: UnitTestRunner;
  tags?: string;
  linter?: LinterType;
  frontendProject?: string;
  swcJest?: boolean;
  /** @deprecated use `swcJest` instead */
  babelJest?: boolean;
  js: boolean;
  enableTypedLinting?: boolean;
  /**
   * @deprecated Use `enableTypedLinting` instead. This option will be removed in Nx v24.
   */
  setParserOptionsProject?: boolean;
  addPlugin?: boolean;
  useProjectJson?: boolean;
  keepExistingVersions?: boolean;
}
