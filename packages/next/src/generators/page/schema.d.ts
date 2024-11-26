import type { NameAndDirectoryFormat } from '@nx/devkit/src/generators/artifact-name-and-directory-utils';
import { SupportedStyles } from '@nx/react';

export interface Schema {
  path: string;
  name?: string;
  style: SupportedStyles;
  fileName?: string;
  withTests?: boolean;
  js?: boolean;
  skipFormat?: boolean;
}
