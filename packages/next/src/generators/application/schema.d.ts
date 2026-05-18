import type { Linter, LinterType } from '@nx/eslint';
import type { SupportedStyles } from '@nx/react';

export interface Schema {
  directory: string;
  name?: string;
  style?: SupportedStyles;
  skipFormat?: boolean;
  tags?: string;
  unitTestRunner?: 'jest' | 'none';
  e2eTestRunner?: 'cypress' | 'playwright' | 'none';
  linter?: Linter | LinterType;
  js?: boolean;
  enableTypedLinting?: boolean;
  /**
   * @deprecated The `setParserOptionsProject` option is deprecated and will be removed in Nx v24. Use `enableTypedLinting` instead.
   */
  setParserOptionsProject?: boolean;
  swc?: boolean;
  customServer?: boolean;
  skipPackageJson?: boolean;
  appDir?: boolean;
  src?: boolean;
  // Internal options
  rootProject?: boolean;
  addPlugin?: boolean;
  useTsSolution?: boolean;
  formatter?: 'prettier' | 'none';
  useProjectJson?: boolean;
}
