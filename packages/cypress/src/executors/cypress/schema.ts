export type Json = { [k: string]: any };

export interface CypressExecutorOptions extends Json {
  cypressConfig: string;
  watch?: boolean;
  devServerTarget?: string;
  headed?: boolean;
  /**
   * @deprecated Cypress runs headless by default. Use the --watch flag to
   * control head/headless behavior instead. It will be removed in Nx v23.
   **/
  headless?: boolean;
  exit?: boolean;
  key?: string;
  record?: boolean;
  parallel?: boolean;
  baseUrl?: string;
  browser?: string;
  env?: Record<string, string>;
  spec?: string;
  ciBuildId?: string | number;
  group?: string;
  ignoreTestFiles?: string | string[];
  reporter?: string;
  reporterOptions?: string | Json;
  skipServe?: boolean;
  testingType?: 'component' | 'e2e';
  tag?: string;
  port?: number | 'cypress-auto';
  quiet?: boolean;
  runnerUi?: boolean;
  autoCancelAfterFailures?: boolean | number;
}
