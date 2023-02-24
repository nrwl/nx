import { ReactNativeBuildIosOptions } from '../build-ios/schema';

// part of options form https://github.com/react-native-community/cli/blob/main/packages/cli-platform-ios/src/commands/runIOS/index.ts
export interface ReactNativeRunIosOptions extends ReactNativeBuildIosOptions {
  /**
   * @deprecated use mode instead, will be removed in nx 16.
   */
  xcodeConfiguration?: string;

  binaryPath?: string;
  listDevices?: boolean;
}
