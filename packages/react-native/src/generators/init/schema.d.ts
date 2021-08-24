export interface Schema {
  unitTestRunner?: 'jest' | 'none';
  skipFormat?: boolean;
  e2eTestRunner?: 'detox' | 'none';
}
