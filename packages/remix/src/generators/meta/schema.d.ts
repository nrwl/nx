import { NameAndDirectoryFormat } from '@nx/devkit/src/generators/artifact-name-and-directory-utils';

export interface MetaSchema {
  path: string;
  nameAndDirectoryFormat?: NameAndDirectoryFormat;
}
