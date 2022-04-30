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
  /**
   * @deprecated
   */
  babelJest?: boolean;
  skipFormat?: boolean;
  compiler?: 'tsc' | 'babel' | 'swc';
  skipPackageJson?: boolean;
  js?: boolean;
}
