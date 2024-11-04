/**
 * Same as the @nx/react library schema, except it removes keys: style, routing, globalCss
 */
export interface Schema {
  path: string;
  name?: string;
  skipTests?: boolean;
  export?: boolean;
  classComponent?: boolean;
  js?: boolean;
}
