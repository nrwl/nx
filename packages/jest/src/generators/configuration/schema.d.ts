export interface JestProjectSchema {
  project: string;
  targetName?: string;
  supportTsx?: boolean;
  setupFile?:
    | 'angular'
    | 'web-components'
    | 'react-native'
    | 'react-router'
    | 'none';
  skipSerializers?: boolean;
  testEnvironment?: 'node' | 'jsdom' | 'none';
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

  /**
   * @deprecated Use the `compiler` option instead. It will be removed in Nx v22.
   */
  babelJest?: boolean;
  /**
   * @deprecated Use the `setupFile` option instead. It will be removed in Nx v22.
   */
  skipSetupFile?: boolean;
  keepExistingVersions?: boolean;
}

export type NormalizedJestProjectSchema = JestProjectSchema & {
  rootProject: boolean;
  isTsSolutionSetup: boolean;
};
