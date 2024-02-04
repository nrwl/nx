export interface Schema {
  name: string;
  /**
   * @deprecated Provide the `directory` option instead and use the `as-provided` format. The project will be determined from the directory provided. It will be removed in Nx v19.
   */
  project: string;
  skipTests?: boolean;
  directory?: string;
  export?: boolean;
  /**
   * @deprecated Provide the `name` option instead and use the `as-provided` format. This option will be removed in Nx v19.
   */
  pascalCaseFiles?: boolean;
  /**
   * @deprecated Provide the `directory` option instead and use the `as-provided` format. This option will be removed in Nx v19.
   */
  pascalCaseDirectory?: boolean;
  /**
   * @deprecated Provide the `directory` option instead and use the `as-provided` format. This option will be removed in Nx v19.
   */
  flat?: boolean;
  js?: boolean;
  nameAndDirectoryFormat?: 'as-provided' | 'derived';
}
