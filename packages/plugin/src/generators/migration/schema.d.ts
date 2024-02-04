import { NameAndDirectoryFormat } from '@nx/devkit/src/generators/artifact-name-and-directory-utils';

export interface Schema {
  name?: string;
  directory?: string;
  description?: string;
  packageVersion: string;
  packageJsonUpdates?: boolean;
  skipFormat?: boolean;
  nameAndDirectoryFormat?: NameAndDirectoryFormat;

  /**
   * @deprecated Provide the `directory` option instead. The project will be determined from the directory provided. It will be removed in Nx v19.
   */
  project?: string;
}
