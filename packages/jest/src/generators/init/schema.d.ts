export interface JestInitSchema {
  compiler?: 'tsc' | 'babel' | 'swc';
  skipPackageJson?: boolean;
  /**
   * @deprecated
   */
  babelJest?: boolean;
}
