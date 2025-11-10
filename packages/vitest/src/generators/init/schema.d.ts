export interface InitGeneratorSchema {
  addPlugin?: boolean;
  rootProject?: boolean;
  keepExistingVersions?: boolean;
  projectRoot?: string;
  updatePackageScripts?: boolean;
  skipFormat?: boolean;
  skipPackageJson?: boolean;
  // Internal only
  viteVersion?: 5 | 6 | 7;
}
