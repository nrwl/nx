import type { FileExtensionType } from '@nx/devkit/internal';

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
  projectType: string | undefined;
  projectDirectory: string;
  projectSourcePath: string | undefined;
  projectModulePath: string | undefined;
  appProjectSourcePath: string | undefined;
  appMainFilePath: string | undefined;
  className: string;
  constantName: string;
  propertyName: string;
  fileName: string;
  fileExtension: string;
  fileExtensionType: FileExtensionType;
}
