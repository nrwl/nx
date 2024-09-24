import { NameAndDirectoryFormat } from '@nx/devkit/src/generators/artifact-name-and-directory-utils';

export interface Schema {
  name: string;
  directory?: string;
  nameAndDirectoryFormat?: NameAndDirectoryFormat;
  prefix?: string;
  skipTests?: boolean;
  skipImport?: boolean;
  selector?: string;
  standalone?: boolean;
  module?: string;
  export?: boolean;
  skipFormat?: boolean;
}

export interface NormalizedSchema extends Schema {
  directory: string;
  filePath: string;
  fileName: string;
  symbolName: string;
  projectName: string;
}
