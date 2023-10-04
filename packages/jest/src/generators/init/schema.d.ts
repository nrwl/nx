export interface JestInitSchema {
  compiler?: 'tsc' | 'babel' | 'swc';
  js?: boolean;
  skipPackageJson?: boolean;
  testEnvironment?: 'node' | 'jsdom' | 'none';
  /**
   * @deprecated
   */
  babelJest?: boolean;
  rootProject?: boolean;
}
