// options taken from https://github.com/react-native-community/cli/blob/main/packages/cli-platform-android/src/commands/buildAndroid/index.ts
// https://github.com/react-native-community/cli/blob/main/packages/cli-platform-android/README.md#build-android

import { ReactNativeStartOptions } from '../start/schema';

export interface ReactNativeBuildAndroidOptions
  extends ReactNativeStartOptions {
  // react native options
  mode: string; // default is debug
  activeArchOnly: boolean; // default is false
  tasks?: string | Array<string>;
  extraParams?: Array<string>;
  interactive: boolean;
}
