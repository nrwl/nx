export interface DockerReleasePublishSchema {
  dryRun?: boolean;
  quiet?: boolean;
  nxReleaseVersionData?: Record<
    string,
    {
      currentVersion: string | null;
      newVersion: string | null;
      dockerVersion: string | null;
      [key: string]: any;
    }
  >;
}
