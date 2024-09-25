import type { NameAndDirectoryFormat } from '@nx/devkit/src/generators/artifact-name-and-directory-utils';

/**
 * Same as the @nx/react library schema, except it removes keys: style, routing, globalCss
 */
export interface Schema {
  path: string;
  name?: string;
  skipTests?: boolean;
  directory?: string;
  export?: boolean;
  classComponent?: boolean;
  js?: boolean;
}
