import type { Linter, LinterType } from '@nx/eslint';

export interface NxRemixGeneratorSchema {
  directory: string;
  name?: string;
  tags?: string;
  js?: boolean;
  linter?: Linter | LinterType;
  unitTestRunner?: 'vitest' | 'jest' | 'none';
  e2eTestRunner?: 'cypress' | 'playwright' | 'none';
  skipFormat?: boolean;
  rootProject?: boolean;
  addPlugin?: boolean;
  nxCloudToken?: string;
}
