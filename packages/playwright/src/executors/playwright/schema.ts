export interface PlaywrightExecutorSchema {
  /*
   * if 'projects' is configured then that name needs to be provided instead of
   * all, chromium, firefox, webkit
   **/
  browser?: 'all' | 'chromium' | 'firefox' | 'webkit' | string;
  config?: string;
  debug?: boolean;
  lastFailed?: boolean;
  forbidOnly?: boolean;
  fullyParallel?: boolean;
  grep?: string;
  globalTimeout?: number;
  grepInvert?: string;
  testFiles?: string[];
  headed?: boolean;
  ignoreSnapshots?: boolean;
  workers?: number | string;
  list?: boolean;
  maxFailures?: number | boolean;
  noDeps?: boolean;
  output?: string;
  passWithNoTests?: boolean;
  project?: string[];
  quiet?: boolean;
  repeatEach?: number;
  reporter?:
    | 'list'
    | 'line'
    | 'dot'
    | 'json'
    | 'junit'
    | 'null'
    | 'github'
    | 'html'
    | 'blob';
  retries?: number;
  shard?: string;
  timeout?: number;
  trace?:
    | 'on'
    | 'off'
    | 'on-first-retry'
    | 'on-all-retries'
    | 'retain-on-failure';
  updateSnapshots?: boolean;
  ui?: boolean;
  uiHost?: string;
  uiPort?: number;
  skipInstall?: boolean;
  cacheDir?: string;
}
