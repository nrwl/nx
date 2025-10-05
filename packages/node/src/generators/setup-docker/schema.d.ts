export interface SetUpDockerOptions {
  project?: string;
  targetName?: string;
  buildTarget?: string;
  skipFormat?: boolean;
  outputPath: string;
  skipDockerPlugin?: boolean;
}
