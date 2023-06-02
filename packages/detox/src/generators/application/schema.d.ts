import { Linter } from '@nx/linter';

export interface Schema {
  appProject: string; // name of the project app to be tested (directory + app name in kebab class)
  appDisplayName?: string; // display name of the app to be tested
  appName?: string; // name of app to be tested if different form appProject, case insenstive
  e2eDirectory?: string; // the directory where e2e app going to be located
  e2eName: string; // name of the e2e app
  linter?: Linter;
  js?: boolean;
  skipFormat?: boolean;
  setParserOptionsProject?: boolean;
  framework: 'react-native' | 'expo';
}
