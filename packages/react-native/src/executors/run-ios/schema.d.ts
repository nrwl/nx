// part of options form https://github.com/react-native-community/cli/blob/master/packages/platform-ios/src/commands/runIOS/index.ts#L541
export interface ReactNativeRunIosOptions {
  xcodeConfiguration: string;
  port: number;
  scheme: string;
  simulator: string;
  device: string;
  packager: boolean; // default is true
  install?: boolean;
  sync?: boolean;
  terminal?: string;
  resetCache: boolean; // default is false
  interactive: boolean; // default is true
}
