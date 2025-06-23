export interface DockerReleasePublishSchema {
  registry?: string;
  repositoryName?: string;
  dryRun?: boolean;
}

export interface NormalizedDockerReleasePublishSchema {
  imageReference: string;
  dryRun: boolean;
}
