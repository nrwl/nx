import type { LinterType } from '@nx/js';

export interface Schema {
  directory: string;
  name?: string;
  displayName?: string;
  style?: string;
  skipFormat?: boolean;
  tags?: string;
  unitTestRunner: 'jest' | 'none'; // default is jest
  classComponent?: boolean;
  js?: boolean;
  linter?: LinterType;
  enableTypedLinting?: boolean;
  e2eTestRunner: 'cypress' | 'playwright' | 'detox' | 'none'; // default is cypress
  bundler: 'webpack' | 'vite'; // default is webpack
  install: boolean; // default is true
  skipPackageJson?: boolean; //default is false
  // Internal options
  nxCloudToken?: string;
  useTsSolution?: boolean;
  formatter?: 'prettier' | 'oxfmt' | 'none';
  useProjectJson?: boolean;
}
