import type { PackageManager } from '@nx/devkit';
import type { LinterType } from '@nx/js';

export interface Schema {
  pluginName: string;
  npmPackageName: string;
  packageManager?: PackageManager;
  projectDirectory?: string;
  pluginOutputPath?: string;
  jestConfig?: string;
  testRunner?: 'jest' | 'vitest';
  linter?: LinterType;
  skipFormat?: boolean;
  rootProject?: boolean;
  useProjectJson?: boolean;
  addPlugin?: boolean;
}
