export interface InitSchema {
  addTsConfigBase?: boolean;
  formatter?: 'none' | 'prettier';
  js?: boolean;
  keepExistingVersions?: boolean;
  skipFormat?: boolean;
  skipPackageJson?: boolean;
  tsConfigName?: string;
  addPlugin?: boolean;
  updatePackageScripts?: boolean;
  addTsPlugin?: boolean;
  platform?: 'web' | 'node';
}
