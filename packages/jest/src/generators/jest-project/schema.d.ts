export interface JestProjectSchema {
  project: string;
  supportTsx?: boolean;
  /**
   * @deprecated use setupFile instead
   */
  skipSetupFile?: boolean;
  setupFile?: 'angular' | 'web-components' | 'none';
  skipSerializers?: boolean;
  testEnvironment?: 'node' | 'jsdom' | '';
  /**
   * @deprecated use compiler: "babel" instead
   */
  babelJest?: boolean;
  skipFormat?: boolean;
  compiler?: 'tsc' | 'babel' | 'swc';
  skipPackageJson?: boolean;
  js?: boolean;
  rootProject?: boolean;
}
