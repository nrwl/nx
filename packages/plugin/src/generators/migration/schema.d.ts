import { NameAndDirectoryFormat } from '@nx/devkit/src/generators/artifact-name-and-directory-utils';

export interface Schema {
  name?: string;
  directory?: string;
  description?: string;
  packageVersion: string;
  packageJsonUpdates?: boolean;
  skipFormat?: boolean;
  nameAndDirectoryFormat?: NameAndDirectoryFormat;
}
