export interface Schema {
  name: string;
  onlyEmptyRoot: boolean;
  root: boolean;
  onlyAddFiles: boolean;
  module: string;
  skipPackageJson: boolean;
  directory: string;
}
