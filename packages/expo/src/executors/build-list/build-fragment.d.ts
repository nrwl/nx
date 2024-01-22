// build fragment from https://github.com/expo/eas-cli/blob/main/packages/eas-cli/src/graphql/generated.ts

export interface BuildFragment {
  __typename?: 'Build';
  id: string;
  status: BuildStatus;
  platform: AppPlatform;
  channel?: string | null;
  releaseChannel?: string | null;
  distribution?: DistributionType | null;
  iosEnterpriseProvisioning?: BuildIosEnterpriseProvisioning | null;
  buildProfile?: string | null;
  sdkVersion?: string | null;
  appVersion?: string | null;
  appBuildVersion?: string | null;
  runtimeVersion?: string | null;
  gitCommitHash?: string | null;
  gitCommitMessage?: string | null;
  initialQueuePosition?: number | null;
  queuePosition?: number | null;
  estimatedWaitTimeLeftSeconds?: number | null;
  priority: BuildPriority;
  createdAt: any;
  updatedAt: any;
  message?: string | null;
  completedAt?: any | null;
  resourceClass: BuildResourceClass;
  error?: {
    __typename?: 'BuildError';
    errorCode: string;
    message: string;
    docsUrl?: string | null;
  } | null;
  artifacts?: {
    __typename?: 'BuildArtifacts';
    buildUrl?: string | null;
    xcodeBuildLogsUrl?: string | null;
    applicationArchiveUrl?: string | null;
  } | null;
  initiatingActor?:
    | { __typename: 'Robot'; id: string; displayName: string }
    | { __typename: 'SSOUser'; id: string; displayName: string }
    | { __typename: 'User'; id: string; displayName: string }
    | null;
  project:
    | {
        __typename: 'App';
        id: string;
        name: string;
        slug: string;
        ownerAccount: { __typename?: 'Account'; id: string; name: string };
      }
    | { __typename: 'Snack'; id: string; name: string; slug: string };
}
