export interface JestProjectSchema {
  project: string;
  supportTsx: boolean;
  skipSetupFile: boolean;
  setupFile: 'angular' | 'web-components' | 'none';
  skipSerializers: boolean;
  testEnvironment: 'node' | 'jsdom' | '';
  babelJest: boolean;
}
