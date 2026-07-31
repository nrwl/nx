import { LinterType } from '@nx/js';

export interface Schema {
  name: string;
  path: string;
  remote: string;
  remoteDirectory?: string;
  e2eTestRunner?: 'cypress' | 'playwright' | 'none';
  host?: string;
  linter?: LinterType;
  skipFormat?: boolean;
  style?: SupportedStyles;
  unitTestRunner?: 'jest' | 'vitest' | 'none';
  bundler?: 'rspack' | 'webpack';
}
