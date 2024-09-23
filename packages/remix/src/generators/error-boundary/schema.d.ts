import { NameAndDirectoryFormat } from '@nx/devkit/src/generators/artifact-name-and-directory-utils';

export interface ErrorBoundarySchema {
  path: string;
  skipFormat?: false;
  nameAndDirectoryFormat?: NameAndDirectoryFormat;
}
