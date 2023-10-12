import type { NameAndDirectoryFormat } from '@nx/devkit/src/generators/artifact-name-and-directory-utils';

export interface Schema {
  project?: string;
  name: string;
  directory?: string;
  description?: string;
  unitTestRunner: 'jest' | 'none';
  includeHasher: boolean;
  nameAndDirectoryFormat?: NameAndDirectoryFormat;
  skipLintChecks?: boolean;
  skipFormat?: boolean;
}
