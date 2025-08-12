export interface JestExecutorOptions {
  codeCoverage?: boolean;
  config?: string;
  detectOpenHandles?: boolean;
  logHeapUsage?: boolean;
  detectLeaks?: boolean;
  jestConfig: string;
  testFile?: string;
  bail?: boolean | number;
  ci?: boolean;
  color?: boolean;
  clearCache?: boolean;
  findRelatedTests?: string;
  forceExit?: boolean;
  json?: boolean;
  maxWorkers?: number | string;
  onlyChanged?: boolean;
  changedSince?: string;
  outputFile?: string;
  passWithNoTests?: boolean;
  randomize?: boolean;
  runInBand?: boolean;
  showConfig?: boolean;
  silent?: boolean;
  testNamePattern?: string;
  testPathIgnorePatterns?: string[];
  testPathPatterns?: string[];
  colors?: boolean;
  reporters?: string[];
  verbose?: boolean;
  coverageReporters?: string[];
  coverageDirectory?: string;
  testResultsProcessor?: string;
  updateSnapshot?: boolean;
  useStderr?: boolean;
  watch?: boolean;
  watchAll?: boolean;
  testLocationInResults?: boolean;
  testTimeout?: number;

  /**
   * @deprecated Use the `setupFilesAfterEnv` option in the Jest configuration
   * file instead. See https://jestjs.io/docs/configuration#setupfilesafterenv-array.
   * It will be removed in Nx v22.
   */
  setupFile?: string;
}
