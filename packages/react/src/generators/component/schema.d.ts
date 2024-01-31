import { SupportedStyles } from '../../../typings/style';

export interface Schema {
  name: string;
  /**
   * @deprecated Provide the `directory` option instead and use the `as-provided` format. The project will be determined from the directory provided. It will be removed in Nx v19.
   */
  project?: string;
  style: SupportedStyles;
  skipTests?: boolean;
  directory?: string;
  export?: boolean;
  /**
   * @deprecated Provide the `name` in pascal-case and use the `as-provided` format. This option will be removed in Nx v19.
   */
  pascalCaseFiles?: boolean;
  /**
   * @deprecated Provide the `directory` in pascal-case and use the `as-provided` format. This option will be removed in Nx v19.
   */
  pascalCaseDirectory?: boolean;
  classComponent?: boolean;
  routing?: boolean;
  js?: boolean;
  /**
   * @deprecated Provide the `directory` option instead and use the `as-provided` format. This option will be removed in Nx v19.
   */
  flat?: boolean;
  globalCss?: boolean;
  fileName?: string;
  inSourceTests?: boolean;
  skipFormat?: boolean;
  nameAndDirectoryFormat?: 'as-provided' | 'derived';
  // Used by other wrapping generators to preserve previous behavior
  // e.g. @nx/next:component
  derivedDirectory?: string;
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
