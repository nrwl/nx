export interface Schema {
  unitTestRunner?: 'jest' | 'none';
  skipFormat?: boolean;
  e2eTestRunner?: 'detox' | 'none';
  skipPackageJson?: boolean; //default is false
  skipTsConfig?: boolean;
  js?: boolean;
}
