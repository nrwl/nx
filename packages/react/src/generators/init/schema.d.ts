export interface InitSchema {
  unitTestRunner?: 'jest' | 'none';
  e2eTestRunner?: 'cypress' | 'none';
  skipFormat?: boolean;
  skipPackageJson?: boolean;
  js?: boolean;
}
