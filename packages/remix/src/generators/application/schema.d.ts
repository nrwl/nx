import type { Linter, LinterType } from '@nx/eslint';

export interface NxRemixGeneratorSchema {
  directory: string;
  name?: string;
  tags?: string;
  linter?: Linter | LinterType;
  unitTestRunner?: 'vitest' | 'jest' | 'none';
  e2eTestRunner?: 'cypress' | 'playwright' | 'none';
  skipFormat?: boolean;
  // Internal options
  rootProject?: boolean;
  addPlugin?: boolean;
  nxCloudToken?: string;
  useTsSolution?: boolean;
}
