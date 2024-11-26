export interface PublishExecutorSchema {
  packageRoot?: string;
  registry?: string;
  tag?: string;
  otp?: number;
  dryRun?: boolean;
  access?: 'public' | 'restricted';
  firstRelease?: boolean;
}
