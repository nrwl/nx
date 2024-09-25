import { NameAndDirectoryFormat } from '@nx/devkit/src/generators/artifact-name-and-directory-utils';

export interface RemixRouteSchema {
  path: string;
  nameAndDirectoryFormat?: NameAndDirectoryFormat;
  action: boolean;
  loader: boolean;
  skipChecks: boolean;
}
