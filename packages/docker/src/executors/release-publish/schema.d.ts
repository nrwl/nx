export interface DockerReleasePublishSchema {
  registry?: string;
  repositoryName?: string;
  version?: string;
  dryRun?: boolean;
}

export interface NormalizedDockerReleasePublishSchema {
  imageReference: string;
  dryRun: boolean;
}
