export interface JestProjectSchema {
  project: string;
  supportTsx?: boolean;
  /**
   * @deprecated
   */
  skipSetupFile?: boolean;
  setupFile?: 'angular' | 'web-components' | 'none';
  skipSerializers?: boolean;
  testEnvironment?: 'node' | 'jsdom' | '';
  transformer?: 'babel-jest' | 'ts-jest' | '@swc/jest';
  skipFormat?: boolean;
}
