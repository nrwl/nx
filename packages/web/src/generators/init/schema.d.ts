export interface Schema {
  bundler?: 'webpack' | 'none';
  unitTestRunner?: 'jest' | 'none';
  e2eTestRunner?: 'cypress' | 'none';
  skipFormat?: boolean;
}
