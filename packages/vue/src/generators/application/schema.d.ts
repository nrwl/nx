import type { Linter, LinterType } from '@nx/eslint';

export interface Schema {
  directory: string;
  name?: string;
  style: 'none' | 'css' | 'scss';
  bundler?: 'vite' | 'rsbuild';
  skipFormat?: boolean;
  tags?: string;
  unitTestRunner?: 'vitest' | 'none';
  inSourceTests?: boolean;
  e2eTestRunner: 'cypress' | 'playwright' | 'none';
  linter: Linter | LinterType;
  formatter?: 'none' | 'prettier';
  routing?: boolean;
  js?: boolean;
  strict?: boolean;
  enableTypedLinting?: boolean;
  /**
   * @deprecated The `setParserOptionsProject` option is deprecated and will be removed in Nx v24. Use `enableTypedLinting` instead.
   */
  setParserOptionsProject?: boolean;
  skipPackageJson?: boolean;
  rootProject?: boolean;
  addPlugin?: boolean;
  nxCloudToken?: string;
  useTsSolution?: boolean;
  useProjectJson?: boolean;
}

export interface NormalizedSchema extends Omit<Schema, 'useTsSolution'> {
  projectName: string;
  appProjectRoot: string;
  importPath: string;
  e2eProjectName: string;
  e2eProjectRoot: string;
  parsedTags: string[];
  devServerPort?: number;
  isUsingTsSolutionConfig: boolean;
}
