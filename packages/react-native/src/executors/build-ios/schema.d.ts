// options from https://github.com/react-native-community/cli/blob/main/packages/cli-platform-ios/src/commands/buildIOS/index.ts

import { ReactNativeStartOptions } from '../start/schema';

export interface ReactNativeBuildIosOptions extends ReactNativeStartOptions {
  // react native options
  simulator?: string;
  mode: string; // default if 'Debug'
  scheme?: string;
  device?: string;
  udid?: string;
  verbose?: boolean;
  port: number; // default is 8081
  xcconfig?: string;
  buildFolder?: string;
  extraParams?: string;
}
