import { Linter } from '@nx/eslint';

export interface UpgradeNativeConfigureSchema {
  name: string;
  displayName?: string;
  js: boolean; // default is false
  e2eTestRunner: 'cypress' | 'playwright' | 'detox' | 'none'; // default is cypress
  install: boolean; // default is true
}
