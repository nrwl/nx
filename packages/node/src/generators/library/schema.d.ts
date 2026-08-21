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
  /**
   * @deprecated Use `enableTypedLinting` instead. This option will be removed in Nx v24.
   */
  setParserOptionsProject?: boolean;
  compiler: 'tsc' | 'swc';
  addPlugin?: boolean;
  useProjectJson?: boolean;
}
