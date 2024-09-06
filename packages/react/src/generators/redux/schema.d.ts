import type { NameAndDirectoryFormat } from '@nx/devkit/src/generators/artifact-name-and-directory-utils';

export interface Schema {
  name: string;
  directory?: string;
  appProject?: string;
  js?: string;
  nameAndDirectoryFormat?: NameAndDirectoryFormat;
}

interface NormalizedSchema extends Schema {
  projectType: string;
  projectSourcePath: string;
  projectModulePath: string;
  appProjectSourcePath: string;
  appMainFilePath: string;
  className: string;
  constantName: string;
  propertyName: string;
  fileName: string;
}
