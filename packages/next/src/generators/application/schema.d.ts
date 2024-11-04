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
  setParserOptionsProject?: boolean;
  swc?: boolean;
  customServer?: boolean;
  skipPackageJson?: boolean;
  appDir?: boolean;
  src?: boolean;
  rootProject?: boolean;
  addPlugin?: boolean;
}
