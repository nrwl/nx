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
  enableTypedLinting?: boolean;
  /**
   * @deprecated Use `enableTypedLinting` instead. This option will be removed in Nx v24.
   */
  setParserOptionsProject?: boolean;
  style?: 'css' | 'scss' | 'none';
  nxCloudToken?: string;
  useTsSolution?: boolean;
  useProjectJson?: boolean;
  useAppDir?: boolean;
}

export interface NormalizedSchema extends Omit<Schema, 'useTsSolution'> {
  projectName: string;
  appProjectRoot: string;
  importPath: string;
  e2eProjectName: string;
  e2eProjectRoot: string;
  parsedTags: string[];
  isUsingTsSolutionConfig: boolean;
  useAppDir: boolean;
  nuxtMajorVersion: 3 | 4;
}
