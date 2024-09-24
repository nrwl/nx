import type { NameAndDirectoryFormat } from '@nx/devkit/src/generators/artifact-name-and-directory-utils';
import { SupportedStyles } from '../../../typings/style';

export interface Schema {
  name: string;
  style: SupportedStyles;
  skipTests?: boolean;
  directory?: string;
  export?: boolean;
  classComponent?: boolean;
  routing?: boolean;
  js?: boolean;
  globalCss?: boolean;
  fileName?: string;
  inSourceTests?: boolean;
  skipFormat?: boolean;
  nameAndDirectoryFormat?: NameAndDirectoryFormat;
  // Used by Next.js to determine how React should generate the page
  isNextPage?: boolean;
}

export interface NormalizedSchema extends Schema {
  projectSourceRoot: string;
  projectName: string;
  fileName: string;
  filePath: string;
  className: string;
  styledModule: null | string;
  hasStyles: boolean;
}
