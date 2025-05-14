import { Linter, LinterType } from '@nx/eslint';

export interface Schema {
  name: string;
  path: string;
  remote: string;
  remoteDirectory?: string;
  e2eTestRunner?: 'cypress' | 'playwright' | 'none';
  host?: string;
  linter?: Linter | LinterType;
  skipFormat?: boolean;
  style?: SupportedStyles;
  unitTestRunner?: 'jest' | 'vitest' | 'none';
  bundler?: 'rspack' | 'webpack';
}
