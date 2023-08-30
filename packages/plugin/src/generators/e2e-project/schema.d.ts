import type { ProjectNameAndRootFormat } from '@nx/devkit/src/generators/project-name-directory-utils';
import type { Linter } from '@nx/linter';

export interface Schema {
  pluginName: string;
  /**
   * @deprecated This option does nothing now and will be removed in Nx 18.
   */
  npmPackageName?: string;
  projectDirectory?: string;
  projectNameAndRootFormat?: ProjectNameAndRootFormat;
  /**
   * @deprecated This option does nothing now and will be removed in Nx 18.
   */
  pluginOutputPath?: string;
  jestConfig?: string;
  linter?: Linter;
  skipFormat?: boolean;
  rootProject?: boolean;
}
