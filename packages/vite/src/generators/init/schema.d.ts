export interface InitGeneratorSchema {
  skipFormat?: boolean;
  setupPathsPlugin?: boolean;
  skipPackageJson?: boolean;
  keepExistingVersions?: boolean;
  updatePackageScripts?: boolean;
  addPlugin?: boolean;
  vitestOnly?: boolean;
}
