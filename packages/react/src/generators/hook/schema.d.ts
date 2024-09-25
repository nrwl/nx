import type { NameAndDirectoryFormat } from '@nx/devkit/src/generators/artifact-name-and-directory-utils';

export interface Schema {
  name: string;
  skipTests?: boolean;
  directory?: string;
  export?: boolean;
  js?: boolean;
  nameAndDirectoryFormat?: NameAndDirectoryFormat;
}
