export interface InitGeneratorSchema {
  keepExistingVersions?: boolean;
  updatePackageScripts?: boolean;
  addPlugin?: boolean;
  skipFormat?: boolean;
  skipPackageJson?: boolean;
}
