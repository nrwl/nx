export interface JestProjectSchema {
  project: string;
  supportTsx?: boolean;
  swcJest?: boolean;
  /**
   * @deprecated
   */
  skipSetupFile?: boolean;
  setupFile?: 'angular' | 'web-components' | 'none';
  skipSerializers?: boolean;
  testEnvironment?: 'node' | 'jsdom' | '';
  babelJest?: boolean;
  skipFormat?: boolean;
}
