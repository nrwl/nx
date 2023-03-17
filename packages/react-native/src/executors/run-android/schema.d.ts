import { ReactNativeBuildAndroidOptions } from '../build-android/schema';
import { ReactNativeStartOptions } from '../start/schema';

// part of options from https://github.com/react-native-community/cli/blob/main/packages/cli-platform-android/src/commands/runAndroid/index.ts
export interface ReactNativeRunAndroidOptions
  extends ReactNativeBuildAndroidOptions {
  /**
   * @deprecated use mode instead
   */
  variant: string;
  /**
   * @deprecated no longer supported in react native cli
   * https://github.com/react-native-community/cli/commit/7c003f2b1d9d80ec5c167614ba533a004272c685
   */
  jetifier: boolean;

  // react native options
  appId: string;
  appIdSuffix: string;
  mainActiviy: string;
  deviceId: string;
  listDevices?: boolean;
  binaryPath?: string;
}
