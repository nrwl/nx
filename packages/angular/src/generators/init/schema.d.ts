export interface Schema {
  skipFormat?: boolean;
  skipInstall?: boolean;
  skipPackageJson?: boolean;
  keepExistingVersions?: boolean;
  /* internal */
  addPlugin?: boolean;
  updatePackageScripts?: boolean;
}
