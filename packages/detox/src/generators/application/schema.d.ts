import type { LinterType } from '@nx/js';

export interface Schema {
  appProject: string; // name of the project app to be tested (directory + app name), case insensitive
  appDisplayName?: string; // display name of the app to be tested
  appName?: string; // name of app to be tested if different form appProject, case insensitive
  e2eDirectory: string; // the directory where e2e app going to be located
  e2eName?: string; // name of the e2e app
  linter?: LinterType;
  js?: boolean;
  skipFormat?: boolean;
  enableTypedLinting?: boolean;
  framework: 'react-native' | 'expo';
  useProjectJson?: boolean;
}
