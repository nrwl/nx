import { ReactNativeBuildIosOptions } from '../build-ios/schema';
import { ReactNativeStartOptions } from '../start/schema';

// part of options form https://github.com/react-native-community/cli/blob/main/packages/cli-platform-ios/src/commands/runIOS/index.ts
export interface ReactNativeRunIosOptions extends ReactNativeBuildIosOptions {
  binaryPath?: string;
}
