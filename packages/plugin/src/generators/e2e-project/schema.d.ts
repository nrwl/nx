import type { Linter, LinterType } from '@nx/eslint';

export interface Schema {
  pluginName: string;
  npmPackageName: string;
  projectDirectory?: string;
  pluginOutputPath?: string;
  jestConfig?: string;
  testRunner?: 'jest' | 'vitest';
  linter?: Linter | LinterType;
  skipFormat?: boolean;
  rootProject?: boolean;
  useProjectJson?: boolean;
  addPlugin?: boolean;
}
