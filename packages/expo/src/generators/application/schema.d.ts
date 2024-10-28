import type { Linter, LinterType } from '@nx/eslint';

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
  linter: Linter | LinterType; // default is eslint
  setParserOptionsProject?: boolean; // default is false
  e2eTestRunner: 'cypress' | 'playwright' | 'detox' | 'none'; // default is none
  standaloneConfig?: boolean;
  skipPackageJson?: boolean; // default is false
  addPlugin?: boolean;
  nxCloudToken?: string;
}
