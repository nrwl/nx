import type { LinterType } from '@nx/js';

export interface Schema {
  directory: string;
  name?: string;
  importPath?: string;
  skipTsConfig?: boolean; // default is false
  skipFormat?: boolean; // default is false
  skipLintChecks?: boolean; // default is false
  e2eTestRunner?: 'jest' | 'vitest' | 'none';
  e2eProjectDirectory?: string;
  tags?: string;
  unitTestRunner?: 'jest' | 'vitest' | 'none';
  linter?: LinterType;
  enableTypedLinting?: boolean;
  compiler?: 'swc' | 'tsc';
  rootProject?: boolean;
  publishable?: boolean;
  useProjectJson?: boolean;
}
