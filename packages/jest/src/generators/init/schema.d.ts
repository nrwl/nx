export interface JestInitSchema {
  compiler?: 'tsc' | 'babel' | 'swc';
  /**
   * @deprecated
   */
  babelJest?: boolean;
}
