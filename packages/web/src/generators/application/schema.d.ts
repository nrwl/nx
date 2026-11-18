import type { LinterType } from '@nx/js';

export interface Schema {
  directory: string;
  name?: string;
  prefix?: string;
  style?: string;
  bundler?: 'webpack' | 'none' | 'vite';
  compiler?: 'babel' | 'swc';
  skipFormat?: boolean;
  tags?: string;
  unitTestRunner?: 'jest' | 'vitest' | 'none';
  inSourceTests?: boolean;
  e2eTestRunner?: 'cypress' | 'playwright' | 'none';
  linter?: LinterType;
  formatter?: 'none' | 'prettier' | 'oxfmt';
  enableTypedLinting?: boolean;
  strict?: boolean;
  useProjectJson?: boolean;
  port?: number;
}
