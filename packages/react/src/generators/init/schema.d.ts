export interface InitSchema {
  unitTestRunner?: 'jest' | 'vitest' | 'none';
  e2eTestRunner?: 'cypress' | 'none';
  skipBabelConfig?: boolean;
  skipFormat?: boolean;
  skipPackageJson?: boolean;
  skipHelperLibs?: boolean;
  js?: boolean;

  rootProject?: boolean;
}
