export interface DockerReleasePublishSchema {
  dryRun?: boolean;
}

export interface NormalizedDockerReleasePublishSchema {
  imageReference: string;
  dryRun: boolean;
}
