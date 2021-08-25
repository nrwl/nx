/**
 * Same as the @nrwl/react library schema, except it removes keys: style, routing, globalCss
 */
export interface Schema {
  name: string;
  project: string;
  skipTests?: boolean;
  directory?: string;
  export?: boolean;
  pascalCaseFiles?: boolean;
  classComponent?: boolean;
  js?: boolean;
  flat?: boolean;
}
