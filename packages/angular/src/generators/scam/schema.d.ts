import { NameAndDirectoryFormat } from '@nx/devkit/src/generators/artifact-name-and-directory-utils';

export interface Schema {
  name: string;
  directory?: string;
  nameAndDirectoryFormat?: NameAndDirectoryFormat;
  displayBlock?: boolean;
  inlineStyle?: boolean;
  inlineTemplate?: boolean;
  viewEncapsulation?: 'Emulated' | 'None' | 'ShadowDom';
  changeDetection?: 'Default' | 'OnPush';
  style?: 'css' | 'scss' | 'sass' | 'less' | 'none';
  skipTests?: boolean;
  inlineScam?: boolean;
  type?: string;
  prefix?: string;
  selector?: string;
  skipSelector?: boolean;
  export?: boolean;
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
  projectName: string;
  fileName: string;
  filePath: string;
  symbolName: string;
  export: boolean;
  inlineScam: boolean;
}
