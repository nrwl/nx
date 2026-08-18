export interface Schema {
  skipFormat?: boolean;
  skipPackageJson?: boolean; //default is false
  keepExistingVersions?: boolean; //default is true
  updatePackageScripts?: boolean;
  addPlugin?: boolean;
}
