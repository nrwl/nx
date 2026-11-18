import type { LinterType } from '@nx/js';

export interface Schema {
  directory: string;
  name?: string;
  simpleModuleName?: boolean;
  skipTsConfig?: boolean;
  skipFormat?: boolean;
  tags?: string;
  unitTestRunner?: 'jest' | 'vitest' | 'none';
  linter?: LinterType;
  buildable?: boolean;
  publishable?: boolean;
  importPath?: string;
  rootDir?: string;
  babelJest?: boolean;
  js?: boolean;
  strict?: boolean;
  enableTypedLinting?: boolean;
  compiler: 'tsc' | 'swc';
  useProjectJson?: boolean;
}
