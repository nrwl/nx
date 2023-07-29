import { Linter } from '@nx/linter';

export interface Schema {
  pluginName: string;
  npmPackageName: string;
  projectDirectory?: string;
  pluginOutputPath?: string;
  jestConfig?: string;
  linter?: Linter;
  skipFormat?: boolean;
  rootProject?: boolean;
}
