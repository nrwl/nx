export interface Schema {
  name: string;
  onlyEmptyRoot: boolean;
  root: boolean;
  skipFormat: boolean;
  onlyAddFiles: boolean;
  module: string;
  skipPackageJson: boolean;
  directory: string;
}
