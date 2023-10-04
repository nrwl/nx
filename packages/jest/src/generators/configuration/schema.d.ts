export interface JestProjectSchema {
  project: string;
  supportTsx?: boolean;
  /**
   * @deprecated use setupFile instead
   */
  skipSetupFile?: boolean;
  setupFile?: 'angular' | 'web-components' | 'none';
  skipSerializers?: boolean;
  testEnvironment?: 'node' | 'jsdom' | 'none';
  /**
   * @deprecated use compiler: "babel" instead
   */
  babelJest?: boolean;
  skipFormat?: boolean;
  compiler?: 'tsc' | 'babel' | 'swc';
  skipPackageJson?: boolean;
  js?: boolean;
}

export type NormalizedJestProjectSchema = JestProjectSchema & {
  rootProject: boolean;
};
