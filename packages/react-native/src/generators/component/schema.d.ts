/**
 * Same as the @nx/react library schema, except it removes keys: style, routing, globalCss
 */
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
   * @deprecated Provide the `directory` option instead and use the `as-provided` format. This option will be removed in Nx v19.
   */
  pascalCaseFiles?: boolean;
  classComponent?: boolean;
  js?: boolean;
  /**
   * @deprecated Provide the `name` in pascal-case and use the `as-provided` format. This option will be removed in Nx v19.
   */
  flat?: boolean;
  nameAndDirectoryFormat?: 'as-provided' | 'derived';
}
