import type { ProjectNameAndRootFormat } from '@nx/devkit/src/generators/project-name-and-root-utils';
import type { Linter } from '@nx/eslint';

export interface Schema {
  name: string;
  style: 'none' | 'css' | 'scss' | 'less';
  skipFormat?: boolean;
  directory?: string;
  projectNameAndRootFormat?: ProjectNameAndRootFormat;
  tags?: string;
  unitTestRunner?: 'vitest' | 'none';
  inSourceTests?: boolean;
  e2eTestRunner: 'cypress' | 'playwright' | 'none';
  linter: Linter;
  routing?: boolean;
  js?: boolean;
  strict?: boolean;
  setParserOptionsProject?: boolean;
  skipPackageJson?: boolean;
  rootProject?: boolean;
  addPlugin?: boolean;
}

export interface NormalizedSchema extends Schema {
  projectName: string;
  appProjectRoot: string;
  e2eProjectName: string;
  e2eProjectRoot: string;
  parsedTags: string[];
  devServerPort?: number;
}
