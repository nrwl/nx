// options from https://github.com/expo/expo/blob/main/packages/%40expo/cli/src/prebuild/index.ts

import { string } from 'yargs';

export interface ExpoPrebuildOptions {
  install: boolean; // default is true
  platform: 'all' | 'android' | 'ios'; // default is all
  template?: string;
}
