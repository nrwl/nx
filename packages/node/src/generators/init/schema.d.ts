export interface Schema {
  unitTestRunner?: 'jest' | 'none';
  skipFormat?: boolean;
  js?: boolean;
  skipPackageJson?: boolean;
  skipTsConfig?: boolean;
}
