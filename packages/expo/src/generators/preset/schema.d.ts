import { Linter } from '@nrwl/linter';

export interface PresetGeneratorSchema {
  name: string;
  appName: string;
  tags?: string;
  directory?: string;
  js: boolean; // default is false
  e2eTestRunner: 'detox' | 'none'; // default is detox
  skipFormat: boolean; // default is true
  linter: Linter; // default is eslint
  unitTestRunner: 'jest' | 'none'; // default is jest
}
