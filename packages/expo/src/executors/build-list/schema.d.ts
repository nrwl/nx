// command to run https://github.com/expo/eas-cli/tree/main#eas-buildlist
// options from https://github.com/expo/eas-cli/blob/main/packages/eas-cli/src/commands/build/list.ts
export interface ExpoEasBuildListOptions {
  platform?: 'ios' | 'android' | 'all';
  interactive?: boolean;
  json?: boolean;
  // status and distribution enum from https://github.com/expo/eas-cli/blob/main/packages/eas-cli/src/build/types.ts
  status?:
    | 'new'
    | 'in-queue'
    | 'in-progress'
    | 'errored'
    | 'finished'
    | 'canceled';
  distribution?: 'store' | 'internal' | 'simulator';
  channel?: string;
  appVersion?: string;
  appBuildVersion?: string;
  sdkVersion?: string;
  runtimeVersion?: string;
  appIdentifier?: string;
  buildProject?: string;
  gitCommitHash?: string;
  limit?: number;
}
