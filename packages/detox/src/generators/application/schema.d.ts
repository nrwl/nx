import { Linter } from '@nrwl/linter';

export interface Schema {
  project: string; // name of the project app to be tested
  displayName?: string; // display name of the mobile app
  name: string; // name of the e2e app
  directory?: string;
  linter?: Linter;
  js?: boolean;
  skipFormat?: boolean;
  setParserOptionsProject?: boolean;
  framework: 'react-native' | 'expo';
}
