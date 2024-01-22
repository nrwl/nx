export interface DetoxTestOptions {
  // options from https://wix.github.io/Detox/docs/cli/test
  // detox test args: https://github.com/wix/Detox/blob/master/detox/local-cli/testCommand/builder.js
  configPath?: string;
  detoxConfiguration: string;
  loglevel?: 'fatal' | 'error' | 'warn' | 'info' | 'verbose' | 'trace';
  retries?: number;
  reuse: boolean; // default is false
  cleanup?: boolean;
  debugSynchronization?: boolean;
  artifactsLocation?: string;
  recordLogs?: 'failing' | 'all' | 'none';
  takeScreenshots?: 'manual' | 'failing' | 'all' | 'none';
  recordVideos?: 'failing' | 'all' | 'none';
  recordPerformance?: 'all' | 'none';
  captureViewHierarchy?: 'enabled' | 'disabled';
  jestReportSpecs?: boolean;
  headeless?: boolean;
  gpu?: boolean;
  keepLockFile?: boolean;
  deviceName?: string;
  deviceBootArgs?: string;
  appLaunchArgs?: string;
  useCustomLogger?: boolean;
  forceAdbInstall?: boolean;
  inspectBrk?: boolean;

  // detox cli options
  color?: boolean;

  // nx build options
  buildTarget?: string;

  // @deprecated(Emily): removed from Detox 20, remove in next major release
  runnerConfig?: string;
  recordTimeline?: 'all' | 'none';
  workers?: number;
  deviceLaunchArgs?: string;
}
