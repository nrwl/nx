// part of options from https://github.com/react-native-community/cli/blob/master/packages/platform-android/src/commands/runAndroid/index.ts#L314
export interface ReactNativeRunAndroidOptions {
  variant: string;
  appId: string;
  appIdSuffix: string;
  mainActiviy: string;
  deviceId: string;
  tasks?: string;
  jetifier: boolean;
  sync: boolean;
  port: number;
  terminal?: string;
  packager: boolean; // default is true
  resetCache: boolean; // default is false
  interactive: boolean; // default is true
}
