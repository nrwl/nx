import type { FileExtensionType } from '@nx/devkit/src/generators/artifact-name-and-directory-utils';
import { SupportedStyles } from '../../../typings/style';

export interface Schema {
  path: string;
  name?: string;
  style: SupportedStyles;
  skipTests?: boolean;
  export?: boolean;
  classComponent?: boolean;
  routing?: boolean;
  globalCss?: boolean;
  inSourceTests?: boolean;
  skipFormat?: boolean;
  // Used by Next.js to determine how React should generate the page
  isNextPage?: boolean;

  /**
   * @deprecated Provide the full file path including the file extension in the `path` option. This option will be removed in Nx v21.
   */
  js?: boolean;
}

export interface NormalizedSchema extends Omit<Schema, 'js'> {
  directory: string;
  projectRoot: string;
  projectSourceRoot: string;
  projectName: string;
  fileName: string;
  filePath: string;
  fileExtension: string;
  fileExtensionType: FileExtensionType;
  className: string;
  styledModule: null | string;
  hasStyles: boolean;
}
