export interface Schema {
  path: string;
  name?: string;
  description?: string;
  unitTestRunner: 'jest' | 'none';
  skipLintChecks?: boolean;
  skipFormat?: boolean;
}
