import type { NameAndDirectoryFormat } from '@nx/devkit/src/generators/artifact-name-and-directory-utils';

export interface ComponentGeneratorSchema {
  name: string;
  skipTests?: boolean;
  directory?: string;
  export?: boolean;
  routing?: boolean;
  js?: boolean;
  fileName?: string;
  inSourceTests?: boolean;
  skipFormat?: boolean;
  nameAndDirectoryFormat?: NameAndDirectoryFormat;
}

export interface NormalizedSchema extends ComponentGeneratorSchema {
  projectName: string;
  projectSourceRoot: string;
  fileName: string;
  className: string;
  filePath: string;
}
