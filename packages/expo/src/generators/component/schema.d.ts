/**
 * Same as the @nrwl/react library schema, except it removes keys: style, routing, globalCss
 */
export interface Schema {
  name: string;
  project: string;
  directory?: string;
  skipFormat: boolean; // default is false
  skipTests: boolean; // default is false
  export: boolean; // default is false
  pascalCaseFiles: boolean; // default is false
  classComponent: boolean; // default is false
  js: boolean; // default is false
  flat: boolean; // default is false
}
