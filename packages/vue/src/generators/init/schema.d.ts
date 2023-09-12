export interface InitSchema {
  unitTestRunner?: 'vitest' | 'jest' | 'none';
  e2eTestRunner?: 'cypress' | 'playwright' | 'none';
  skipFormat?: boolean;
  js?: boolean;
  rootProject?: boolean;
  routing?: boolean;
  style?: 'css' | 'scss' | 'less' | 'none';
}
