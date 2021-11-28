// options from https://docs.expo.dev/workflow/expo-cli/#expo-buildandroid
export interface ExpoBuildAndroidOptions {
  clearCredentials?: boolean;
  type?: 'app-bundle' | 'apk';
  releaseChannel?: string;
  noPublish?: boolean;
  noWait?: boolean;
  keystorePath?: string;
  keystoreAlias?: string;
  publicUrl?: string;
  skipWorkflowCheck?: boolean;
}
