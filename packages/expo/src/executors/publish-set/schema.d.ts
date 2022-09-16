// options from https://docs.expo.dev/workflow/expo-cli/#expo-publishrollback
export interface ExpoPublishSetOptions {
  releaseChannel: string;
  sdkVersion: string;
  platform?: 'ios' | 'android';
}
