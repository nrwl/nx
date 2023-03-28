// options taken from https://github.com/react-native-community/cli/blob/main/packages/cli-platform-android/src/commands/buildAndroid/index.ts

import { ReactNativeStartOptions } from '../start/schema';

export interface ReactNativeBuildAndroidOptions
  extends ReactNativeStartOptions {
  /**
   * @deprecated, use tasks instead. e.g. tasks=['bundleRelease'] for aab, and tasks=['assembleRelease'] for apk. Will be removed in nx 17.
   */
  apk?: boolean;
  /**
   * @deprecated, use mode='debug' instead. Will be removed in nx 17.
   */
  debug?: boolean;
  /**
   * @deprecated, use tasks instead instead. Will be removed in nx 17.
   */
  gradleTask?: string;

  // react native options
  mode: string; // default is debug
  activeArchOnly: boolean; // default is false
  port: number; // default is 8081
  tasks?: Array<string>;
  extraParams?: Array<string>;
  interactive?: boolean;

  // nx options
  packager: boolean; // default is true
  sync: boolean;
}
