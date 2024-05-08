import { NameAndDirectoryFormat } from '@nx/devkit/src/generators/artifact-name-and-directory-utils';

export interface RemixStyleSchema {
  path: string;
  nameAndDirectoryFormat?: NameAndDirectoryFormat;
  /**
   * @deprecated Provide the `path` option instead. The project will be determined from the path provided. It will be removed in Nx v19.
   */
  project?: string;
}
