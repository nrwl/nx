export interface InitSchema {
  unitTestRunner?: 'jest' | 'vitest' | 'none';
  e2eTestRunner?: 'cypress' | 'none';
  skipFormat?: boolean;
  skipPackageJson?: boolean;
  skipHelperLibs?: boolean;
  js?: boolean;

  rootProject?: boolean;
}
