export interface JestInitSchema {
  skipFormat?: boolean;
  skipPackageJson?: boolean;
  keepExistingVersions?: boolean;
  updatePackageScripts?: boolean;

  addPlugin?: boolean;
}
