// `LinterType` comes from `@nx/js`, not `@nx/eslint`: this package is the one
// `@nx/eslint` importer that does not declare it as a dependency, so the
// specifier resolves to the published tarball, whose `LinterType` predates
// `oxlint` and would contradict the enum in schema.json.
import type { Linter } from '@nx/eslint';
import type { LinterType } from '@nx/js';
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
   * @deprecated Use `enableTypedLinting` instead. This option will be removed in Nx v24.
   */
  setParserOptionsProject?: boolean;
  addPlugin?: boolean;
  useProjectJson?: boolean;
  keepExistingVersions?: boolean;
}
