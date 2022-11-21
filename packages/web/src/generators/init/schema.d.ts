export interface Schema {
  bundler?: 'webpack' | 'none' | 'vite';
  unitTestRunner?: 'jest' | 'none';
  e2eTestRunner?: 'cypress' | 'none';
  skipFormat?: boolean;
  skipPackageJson?: boolean;
}
