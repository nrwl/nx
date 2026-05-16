/**
 * Same as the @nx/react library schema, except it removes keys: style, routing, globalCss
 */
export interface Schema {
  path: string;
  name?: string;
  skipFormat?: boolean;
  skipTests?: boolean;
  export?: boolean;
  classComponent?: boolean;
}
