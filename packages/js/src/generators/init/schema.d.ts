export interface InitSchema {
  addTsConfigBase?: boolean;
  formatter?: 'none' | 'prettier' | 'oxfmt';
  js?: boolean;
  keepExistingVersions?: boolean;
  skipFormat?: boolean;
  skipPackageJson?: boolean;
  tsConfigName?: string;
  updatePackageScripts?: boolean;
  addTsPlugin?: boolean;
  platform?: 'web' | 'node';
}
