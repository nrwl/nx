export interface NgRxGeneratorOptions {
  directory: string;
  minimal: boolean;
  module: string;
  name: string;
  barrels?: boolean;
  facade?: boolean;
  root?: boolean;
  skipFormat?: boolean;
  skipImport?: boolean;
  skipPackageJson?: boolean;
  /**
   * @deprecated This option is deprecated and will be removed in v15.
   * Using the individual operators is recommended.
   */
  useDataPersistence?: boolean;
}
