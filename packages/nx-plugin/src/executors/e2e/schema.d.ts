import { JestExecutorOptions } from '@nrwl/jest/src/executors/jest/schema';

export interface NxPluginE2EExecutorOptions extends JestExecutorOptions {
  target: string;
  jestConfig: string;
}
