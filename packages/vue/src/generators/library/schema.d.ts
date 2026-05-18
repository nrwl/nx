import type { Linter, LinterType } from '@nx/eslint';

export interface Schema {
  appProject?: string;
  bundler?: 'none' | 'vite';
  component?: boolean;
  directory: string;
  importPath?: string;
  inSourceTests?: boolean;
  js?: boolean;
  linter: Linter | LinterType;
  name?: string;
  publishable?: boolean;
  routing?: boolean;
  enableTypedLinting?: boolean;
  /**
   * @deprecated The `setParserOptionsProject` option is deprecated and will be removed in Nx v24. Use `enableTypedLinting` instead.
   */
  setParserOptionsProject?: boolean;
  skipFormat?: boolean;
  skipPackageJson?: boolean;
  skipTsConfig?: boolean;
  strict?: boolean;
  tags?: string;
  unitTestRunner?: 'vitest' | 'none';
  minimal?: boolean;
  e2eTestRunner?: 'cypress' | 'none';
  addPlugin?: boolean;
  useProjectJson?: boolean;
}

export interface NormalizedSchema extends Schema {
  js: boolean;
  name: string;
  projectName: string;
  linter: Linter | LinterType;
  fileName: string;
  projectRoot: string;
  routePath: string;
  parsedTags: string[];
  appMain?: string;
  appSourceRoot?: string;
  unitTestRunner?: 'vitest' | 'none';
  isUsingTsSolutionConfig: boolean;
}
