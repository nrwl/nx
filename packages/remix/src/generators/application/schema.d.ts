import type { LinterType } from '@nx/js';

export interface NxRemixGeneratorSchema {
  directory: string;
  name?: string;
  tags?: string;
  linter?: LinterType;
  unitTestRunner?: 'vitest' | 'jest' | 'none';
  e2eTestRunner?: 'cypress' | 'playwright' | 'none';
  skipFormat?: boolean;
  // Internal options
  rootProject?: boolean;
  addPlugin?: boolean;
  nxCloudToken?: string;
  useTsSolution?: boolean;
  formatter?: 'prettier' | 'oxfmt' | 'none';
  useProjectJson?: boolean;
}
