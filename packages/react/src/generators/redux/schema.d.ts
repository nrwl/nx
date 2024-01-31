export interface Schema {
  name: string;
  /**
   * @deprecated Provide the `directory` option instead and use the `as-provided` format. The project will be determined from the directory provided. It will be removed in Nx v19.
   */
  project?: string;
  directory?: string;
  appProject?: string;
  js?: string;
  nameAndDirectoryFormat?: 'as-provided' | 'derived';
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
