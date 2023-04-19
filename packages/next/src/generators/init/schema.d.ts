export interface InitSchema {
  unitTestRunner?: 'jest' | 'none';
  e2eTestRunner?: 'cypress' | 'none';
  skipFormat?: boolean;
  js?: boolean;
  skipPackageJson?: boolean;
  rootProject?: boolean;
}
