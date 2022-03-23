// options from https://github.com/wix/Detox/blob/master/docs/APIRef.DetoxCLI.md#test
// detox test args: https://github.com/wix/Detox/blob/master/detox/local-cli/utils/testCommandArgs.js
export interface DetoxTestOptions {
  configPath?: string;
  detoxConfiguration: string;
  runnerConfig?: string;
  deviceName?: string;
  loglevel?: string;
  debugSynchronization?: boolean;
  artifactsLocation?: string;
  recordLogs?: 'failing' | 'all' | 'none';
  takeScreenshots?: 'manual' | 'failing' | 'all' | 'none';
  recordVideos?: 'failing' | 'all' | 'none';
  recordPerformance?: 'all' | 'none';
  recordTimeline?: 'all' | 'none';
  captureViewHierarchy?: 'enabled' | 'disabled';
  retries?: number;
  resuse?: boolean;
  cleanup?: boolean;
  workers?: number;
  jestReportSpecs?: boolean;
  headeless?: boolean;
  gpu?: boolean;
  deviceLauchArgs?: string;
  appLaunchArgs?: string;
  noColor?: boolean;
  useCutsomeLogger?: boolean;
  forceAdbInstall?: boolean;
  inspectBrk?: boolean;
  buildTarget?: string;
}
