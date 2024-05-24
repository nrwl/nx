import type { NameAndDirectoryFormat } from '@nx/devkit/src/generators/artifact-name-and-directory-utils';

export interface Schema {
  name: string;
  directory?: string;
  nameAndDirectoryFormat?: NameAndDirectoryFormat;
  displayBlock?: boolean;
  inlineStyle?: boolean;
  inlineTemplate?: boolean;
  standalone?: boolean;
  viewEncapsulation?: 'Emulated' | 'None' | 'ShadowDom';
  changeDetection?: 'Default' | 'OnPush';
  style?: 'css' | 'scss' | 'sass' | 'less' | 'none';
  skipTests?: boolean;
  type?: string;
  skipImport?: boolean;
  selector?: string;
  module?: string;
  skipSelector?: boolean;
  export?: boolean;
  prefix?: string;
  skipFormat?: boolean;

  /**
   * @deprecated Provide the `directory` option instead and use the `as-provided` format. It will be removed in Nx v20.
   */
  flat?: boolean;
  /**
   * @deprecated Provide the `directory` option instead. It will be removed in Nx v20.
   */
  path?: string;
  /**
   * @deprecated Provide the `directory` option instead. The project will be determined from the directory provided. It will be removed in Nx v20.
   */
  project?: string;
}

export interface NormalizedSchema extends Schema {
  directory: string;
  filePath: string;
  projectName: string;
  projectSourceRoot: string;
  projectRoot: string;
  selector: string;

  fileName: string;
  symbolName: string;
}
