export interface Schema {
  path: string;
  name?: string;
  description?: string;
  unitTestRunner: 'jest' | 'none';
  includeHasher: boolean;
  skipLintChecks?: boolean;
  skipFormat?: boolean;
}
