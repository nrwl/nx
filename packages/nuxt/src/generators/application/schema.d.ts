import type { Linter, LinterType } from '@nx/eslint';

export interface Schema {
  directory: string;
  name?: string;
  linter?: Linter | LinterType;
  formatter?: 'none' | 'prettier';
  skipFormat?: boolean;
  unitTestRunner?: 'vitest' | 'none';
  e2eTestRunner?: 'cypress' | 'playwright' | 'none';
  tags?: string;
  js?: boolean;
  skipPackageJson?: boolean;
  rootProject?: boolean;
  setParserOptionsProject?: boolean;
  style?: 'css' | 'scss' | 'less' | 'none';
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
  isUsingTsSolutionConfig: boolean;
}
