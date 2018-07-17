export interface Schema {
  name: string;
  module: string;
  directory: string;
  root: boolean;
  facade: boolean;
  onlyEmptyRoot: boolean;
  onlyAddFiles: boolean;
  skipFormat: boolean;
  skipPackageJson: boolean;
}
