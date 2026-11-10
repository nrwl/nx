// `LinterType` comes from `@nx/js`, which this package declares; `@nx/eslint`
// is not a dependency here, so importing it would resolve to a published
// tarball rather than workspace source.
import type { LinterType } from '@nx/js';

export interface Schema {
  directory: string;
  name?: string;
  skipFormat: boolean;
  skipPackageJson: boolean;
  unitTestRunner: 'jest' | 'vitest' | 'none';
  tags?: string;
  linter?: LinterType;
  frontendProject?: string;
  swcJest?: boolean;
  /** @deprecated use `swcJest` instead */
  babelJest?: boolean;
  js: boolean;
  enableTypedLinting?: boolean;
  useProjectJson?: boolean;
  keepExistingVersions?: boolean;
}
