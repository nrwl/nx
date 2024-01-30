export interface PublishExecutorSchema {
  packageRoot?: string;
  registry?: string;
  tag?: string;
  otp?: number;
  dryRun?: boolean;
  firstRelease?: boolean;
}
