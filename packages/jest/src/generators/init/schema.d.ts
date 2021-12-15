export interface JestInitSchema {
  compiler?: 'tsc' | 'swc' | 'babel';
  /**
   * @deprecated
   */
  babelJest?: boolean;
}
