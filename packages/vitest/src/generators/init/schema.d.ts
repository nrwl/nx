export interface InitGeneratorSchema {
  addPlugin?: boolean;
  rootProject?: boolean;
  keepExistingVersions?: boolean;
  updatePackageScripts?: boolean;
  skipFormat?: boolean;
  skipPackageJson?: boolean;
}
