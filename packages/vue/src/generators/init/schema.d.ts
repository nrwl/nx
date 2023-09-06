export interface InitSchema {
  unitTestRunner?: 'vitest' | 'jest' | 'none'; // TODO: more or different to be added here
  e2eTestRunner?: 'cypress' | 'playwright' | 'none'; // TODO: more or different to be added here
  skipFormat?: boolean;
  js?: boolean;
  rootProject?: boolean;
  routing?: boolean;
}
