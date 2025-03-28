import type { FileExtensionType } from '@nx/devkit/src/generators/artifact-name-and-directory-utils';

export interface Schema {
  path: string;
  name?: string;
  appProject?: string;

  /**
   * @deprecated Provide the full file path including the file extension in the `path` option. This option will be removed in Nx v21.
   */
  js?: boolean;
}

interface NormalizedSchema extends Omit<Schema, 'js'> {
  projectType: string;
  projectDirectory: string;
  projectSourcePath: string;
  projectModulePath: string;
  appProjectSourcePath: string;
  appMainFilePath: string;
  className: string;
  constantName: string;
  propertyName: string;
  fileName: string;
  fileExtension: string;
  fileExtensionType: FileExtensionType;
}
