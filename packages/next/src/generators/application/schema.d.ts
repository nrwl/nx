import type { LinterType } from '@nx/js';
import type { SupportedStyles } from '@nx/react';

export interface Schema {
  directory: string;
  name?: string;
  style?: SupportedStyles;
  skipFormat?: boolean;
  tags?: string;
  unitTestRunner?: 'jest' | 'none';
  e2eTestRunner?: 'cypress' | 'playwright' | 'none';
  linter?: LinterType;
  js?: boolean;
  enableTypedLinting?: boolean;
  /**
   * @deprecated Use `enableTypedLinting` instead. This option will be removed in Nx v24.
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
  formatter?: 'prettier' | 'oxfmt' | 'none';
  useProjectJson?: boolean;
}
