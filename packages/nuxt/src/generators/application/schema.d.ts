import type { ProjectNameAndRootFormat } from '@nx/devkit/src/generators/project-name-and-root-utils';
import type { Linter, LinterType } from '@nx/eslint';

export interface Schema {
  name: string;
  directory?: string;
  projectNameAndRootFormat?: ProjectNameAndRootFormat;
  linter?: Linter | LinterType;
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
}

export interface NormalizedSchema extends Schema {
  projectName: string;
  appProjectRoot: string;
  e2eProjectName: string;
  e2eProjectRoot: string;
  parsedTags: string[];
}
