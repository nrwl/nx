export interface JestInitSchema {
  compiler?: 'tsc' | 'babel' | 'swc';
  js?: boolean;
  skipPackageJson?: boolean;
  /**
   * @deprecated
   */
  babelJest?: boolean;
  rootProject?: boolean;
}
