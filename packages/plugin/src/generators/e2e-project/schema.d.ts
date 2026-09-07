import type { LinterType } from '@nx/js';

export interface Schema {
  pluginName: string;
  npmPackageName: string;
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
