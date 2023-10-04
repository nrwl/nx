export interface Schema {
  bundler?: 'webpack' | 'none' | 'vite';
  unitTestRunner?: 'jest' | 'vitest' | 'none';
  e2eTestRunner?: 'cypress' | 'playwright' | 'none';
  skipFormat?: boolean;
  skipPackageJson?: boolean;
}
