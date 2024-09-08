export interface InitSchema {
  addTsConfigBase?: boolean;
  js?: boolean;
  keepExistingVersions?: boolean;
  setUpPrettier?: boolean;
  skipFormat?: boolean;
  skipPackageJson?: boolean;
  tsConfigName?: string;
}
