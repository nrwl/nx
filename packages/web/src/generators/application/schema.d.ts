import type { Linter, LinterType } from '@nx/eslint';

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
  linter?: Linter | LinterType;
  setParserOptionsProject?: boolean;
  strict?: boolean;
  addPlugin?: boolean;
  useProjectJson?: boolean;
}
