import { ReactNativeBuildAndroidOptions } from '../build-android/schema';
import { ReactNativeStartOptions } from '../start/schema';

// part of options from https://github.com/react-native-community/cli/blob/main/packages/cli-platform-android/src/commands/runAndroid/index.ts
export interface ReactNativeRunAndroidOptions
  extends ReactNativeBuildAndroidOptions {
  appId: string;
  appIdSuffix: string;
  mainActiviy: string;
  deviceId: string;
  listDevices?: boolean;
  binaryPath?: string;
}
