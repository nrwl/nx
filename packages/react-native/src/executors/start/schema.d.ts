// options from https://github.com/react-native-community/cli/blob/main/packages/cli-plugin-metro/src/commands/start/index.ts

export interface ReactNativeStartOptions {
  port: number;
  resetCache: boolean; // default is false
  interactive: boolean; // default is true
}
