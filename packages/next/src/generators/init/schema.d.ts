export interface InitSchema {
  unitTestRunner?: 'jest' | 'none';
  e2eTestRunner?: 'cypress' | 'playwright' | 'none';
  skipFormat?: boolean;
  js?: boolean;
  skipPackageJson?: boolean;
  rootProject?: boolean;
}
