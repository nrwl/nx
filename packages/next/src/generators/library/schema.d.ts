import type { Linter, LinterType } from '@nx/eslint';
import type { SupportedStyles } from '@nx/react';

export interface Schema {
  directory: string;
  name?: string;
  style: SupportedStyles;
  skipTsConfig?: boolean;
  skipFormat?: boolean;
  tags?: string;
  routing?: boolean;
  appProject?: string;
  unitTestRunner: 'jest' | 'vitest' | 'none';
  linter: Linter | LinterType;
  component?: boolean;
  publishable?: boolean;
  buildable?: boolean;
  importPath?: string;
  js?: boolean;
  globalCss?: boolean;
  strict?: boolean;
  setParserOptionsProject?: boolean;
  skipPackageJson?: boolean;
  addPlugin?: boolean;
}
