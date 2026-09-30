import type { LinterType } from '@nx/js';

export interface Schema {
  directory: string;
  name?: string;
  displayName?: string;
  style?: string;
  skipFormat: boolean; // default is false
  tags?: string;
  unitTestRunner: 'jest' | 'none'; // default is jest
  classComponent?: boolean;
  js: boolean; // default is false
  linter?: LinterType;
  enableTypedLinting?: boolean; // default is false
  /**
   * @deprecated Use `enableTypedLinting` instead. This option will be removed in Nx v24.
   */
  setParserOptionsProject?: boolean; // default is false
  e2eTestRunner: 'cypress' | 'playwright' | 'detox' | 'none'; // default is none
  skipPackageJson?: boolean; // default is false
  // Internal options
  addPlugin?: boolean;
  nxCloudToken?: string;
  useTsSolution?: boolean;
  formatter?: 'prettier' | 'oxfmt' | 'none';
  useProjectJson?: boolean;
}
