export interface InitGeneratorSchema {
  skipFormat?: boolean;
  addTsPathsPlugin?: boolean;
  skipPackageJson?: boolean;
  keepExistingVersions?: boolean;
  updatePackageScripts?: boolean;
  addPlugin?: boolean;
  vitestOnly?: boolean;
}
