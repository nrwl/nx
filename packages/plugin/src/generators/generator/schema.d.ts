export interface Schema {
  path: string;
  name?: string;
  description?: string;
  unitTestRunner: 'jest' | 'vitest' | 'none';
  skipLintChecks?: boolean;
  skipFormat?: boolean;
}
