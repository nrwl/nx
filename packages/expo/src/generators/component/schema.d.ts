/**
 * Same as the @nx/react library schema, except it removes keys: style, routing, globalCss
 */
export interface Schema {
  name: string;
  /**
   * @deprecated Provide the `directory` option instead and use the `as-provided` format. The project will be determined from the directory provided. It will be removed in Nx v19.
   */
  project: string;
  directory?: string;
  skipFormat: boolean; // default is false
  skipTests: boolean; // default is false
  /**
   * @deprecated Provide the name in pascal-case and use the `as-provided` format. This option will be removed in Nx v19.
   */
  export: boolean; // default is false
  pascalCaseFiles: boolean; // default is false
  classComponent: boolean; // default is false
  js: boolean; // default is false
  /**
   * @deprecated Provide the `directory` option instead and use the `as-provided` format. This option will be removed in Nx v19.
   */
  flat: boolean; // default is false
  nameAndDirectoryFormat?: 'as-provided' | 'derived';
}
