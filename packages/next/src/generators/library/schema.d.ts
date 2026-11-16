import type { LinterType } from '@nx/js';
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
  inSourceTests?: boolean;
  linter?: LinterType;
  component?: boolean;
  publishable?: boolean;
  /** @deprecated Use bundler instead. */
  buildable?: boolean;
  bundler?: 'none' | 'vite' | 'rollup';
  compiler?: 'babel' | 'swc';
  importPath?: string;
  js?: boolean;
  globalCss?: boolean;
  strict?: boolean;
  enableTypedLinting?: boolean;
  skipPackageJson?: boolean;
  useProjectJson?: boolean;
}
