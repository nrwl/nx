import { Linter } from '@nrwl/linter';

export interface UpgradeNativeConfigureSchema {
  name: string;
  displayName?: string;
  js: boolean; // default is false
  e2eTestRunner: 'detox' | 'none'; // default is detox
}
