import type { NameAndDirectoryFormat } from '@nx/devkit/src/generators/artifact-name-and-directory-utils';
import { SupportedStyles } from '@nx/react';

export interface Schema {
  name: string;
  style: SupportedStyles;
  directory?: string;
  fileName?: string;
  withTests?: boolean;
  js?: boolean;
  skipFormat?: boolean;
  nameAndDirectoryFormat?: NameAndDirectoryFormat;
}
