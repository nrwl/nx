export interface NgRxGeneratorOptions {
  directory: string;
  minimal: boolean;
  module: string;
  name: string;
  useDataPersistence: boolean;
  barrels?: boolean;
  facade?: boolean;
  root?: boolean;
  skipFormat?: boolean;
  skipImport?: boolean;
  skipPackageJson?: boolean;
  syntax?: 'classes' | 'creators';

  /**
   * @deprecated use `skipImport`.
   */
  onlyAddFiles?: boolean;

  /**
   * @deprecated use `minimal`.
   */
  onlyEmptyRoot?: boolean;
}
