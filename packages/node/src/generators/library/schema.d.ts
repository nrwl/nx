import type { Linter, LinterType } from '@nx/eslint';

export interface Schema {
  directory: string;
  name?: string;
  simpleModuleName?: boolean;
  skipTsConfig?: boolean;
  skipFormat?: boolean;
  tags?: string;
  unitTestRunner?: 'jest' | 'none';
  linter?: Linter | LinterType;
  buildable?: boolean;
  publishable?: boolean;
  importPath?: string;
  testEnvironment?: 'jsdom' | 'node';
  rootDir?: string;
  babelJest?: boolean;
  js?: boolean;
  strict?: boolean;
  enableTypedLinting?: boolean;
  /**
   * @deprecated The `setParserOptionsProject` option is deprecated and will be removed in Nx v24. Use `enableTypedLinting` instead.
   */
  setParserOptionsProject?: boolean;
  compiler: 'tsc' | 'swc';
  addPlugin?: boolean;
  useProjectJson?: boolean;
}
