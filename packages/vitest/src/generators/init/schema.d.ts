export interface InitGeneratorSchema {
  rootProject?: boolean;
  keepExistingVersions?: boolean;
  projectRoot?: string;
  updatePackageScripts?: boolean;
  skipFormat?: boolean;
  skipPackageJson?: boolean;
  // Internal only
  viteVersion?: 5 | 6 | 7 | 8;
}
