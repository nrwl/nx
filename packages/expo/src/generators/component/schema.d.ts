/**
 * Same as the @nx/react library schema, except it removes keys: style, routing, globalCss
 */
export interface Schema {
  path: string;
  name?: string;
  skipFormat: boolean; // default is false
  skipTests: boolean; // default is false
  export: boolean; // default is false
  classComponent: boolean; // default is false
  js: boolean; // default is false
  nameAndDirectoryFormat?: NameAndDirectoryFormat;
}
