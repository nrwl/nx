export interface Schema {
  name: string;
  module: string;
  directory: string;
  root: boolean;
  facade: boolean;
  minimal: boolean;
  skipImport: boolean;
  /**
   * @deprecated use `minimal`
   */
  onlyEmptyRoot: boolean;

  /**
   * @deprecated use `skipImport`
   */
  onlyAddFiles: boolean;
  skipFormat: boolean;
  skipPackageJson: boolean;
  syntax?: string;
  useDataPersistence: boolean;
  barrels: boolean;
}
