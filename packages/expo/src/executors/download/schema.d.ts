// subset options from https://github.com/expo/eas-cli/blob/main/packages/eas-cli/src/commands/build/list.ts
export interface ExpoEasDownloadOptions {
  platform: 'ios' | 'android' | 'all';
  // status and distribution enum from https://github.com/expo/eas-cli/blob/main/packages/eas-cli/src/build/types.ts
  distribution?: 'store' | 'internal' | 'simulator';
  channel?: string;
  appVersion?: string;
  appBuildVersion?: string;
  sdkVersion?: string;
  runtimeVersion?: string;
  appIdentifier?: string;
  buildProject?: string;
  gitCommitHash?: string;
  output: string;
}
