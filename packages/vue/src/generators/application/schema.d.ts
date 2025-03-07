import type { Linter, LinterType } from '@nx/eslint';

export interface Schema {
  directory: string;
  name?: string;
  style: 'none' | 'css' | 'scss' | 'less';
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
  setParserOptionsProject?: boolean;
  skipPackageJson?: boolean;
  rootProject?: boolean;
  addPlugin?: boolean;
  nxCloudToken?: string;
  useTsSolution?: boolean;
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
