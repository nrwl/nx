import { NameAndDirectoryFormat } from '@nx/devkit/src/generators/artifact-name-and-directory-utils';

export interface RemixRouteSchema {
  path: string;
  action: boolean;
  loader: boolean;
  skipChecks: boolean;
}
