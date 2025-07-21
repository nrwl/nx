export interface DockerReleasePublishSchema {
  dryRun?: boolean;
  quiet?: boolean;
}

export interface NormalizedDockerReleasePublishSchema {
  quiet: boolean;
  imageReference: string;
  dryRun: boolean;
}
