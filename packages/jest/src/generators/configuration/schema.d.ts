export interface JestProjectSchema {
  project: string;
  targetName?: string;
  supportTsx?: boolean;
  /**
   * @deprecated use setupFile instead
   */
  skipSetupFile?: boolean;
  setupFile?: 'angular' | 'web-components' | 'react-native' | 'none';
  skipSerializers?: boolean;
  testEnvironment?: 'node' | 'jsdom' | 'none';
  /**
   * @deprecated use compiler: "babel" instead
   */
  babelJest?: boolean;
  skipFormat?: boolean;

  addPlugin?: boolean;
  compiler?: 'tsc' | 'babel' | 'swc';
  skipPackageJson?: boolean;
  js?: boolean;
  runtimeTsconfigFileName?: string;

  /**
   * @internal
   */
  addExplicitTargets?: boolean;
}

export type NormalizedJestProjectSchema = JestProjectSchema & {
  rootProject: boolean;
};
