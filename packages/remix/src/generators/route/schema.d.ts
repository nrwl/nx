import { NameAndDirectoryFormat } from '@nx/devkit/src/generators/artifact-name-and-directory-utils';

export interface RemixRouteSchema {
  path: string;
  nameAndDirectoryFormat?: NameAndDirectoryFormat;
  style: 'css' | 'none';
  action: boolean;
  meta: boolean;
  loader: boolean;
  skipChecks: boolean;
}
