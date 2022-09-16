// options from https://docs.expo.dev/workflow/expo-cli/#expo-publishrollback
export interface ExpoRollbackOptions {
  releaseChannel: string;
  sdkVersion: string;
  platform?: 'ios' | 'android';
}
