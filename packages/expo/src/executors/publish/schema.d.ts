// options from https://docs.expo.dev/workflow/expo-cli/#expo-publish
export interface ExpoPublishOptions {
  quiet: boolean; // default is false
  sendTo?: string;
  clear: boolean; // default is false
  target: 'managed' | 'bare';
  maxWorkers?: number;
  releaseChannel: string; // default is 'default'
  sync: boolean; // default is true
}
