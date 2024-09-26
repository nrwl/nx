export interface Schema {
  name: string;
  directory?: string;
  description?: string;
  unitTestRunner: 'jest' | 'none';
  includeHasher: boolean;
  nameAndDirectoryFormat?: NameAndDirectoryFormat;
  skipLintChecks?: boolean;
  skipFormat?: boolean;
}
