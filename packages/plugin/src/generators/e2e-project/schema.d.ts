import type { ProjectNameAndRootFormat } from '@nx/devkit/src/generators/project-name-directory-utils';
import type { Linter } from '@nx/eslint';

export interface Schema {
  pluginName: string;
  npmPackageName: string;
  projectDirectory?: string;
  projectNameAndRootFormat?: ProjectNameAndRootFormat;
  pluginOutputPath?: string;
  jestConfig?: string;
  linter?: Linter;
  skipFormat?: boolean;
  rootProject?: boolean;
}
