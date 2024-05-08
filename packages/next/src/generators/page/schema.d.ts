import { SupportedStyles } from '@nx/react';

export interface Schema {
  name: string;
  /**
   * @deprecated Provide the `directory` option instead and use the `as-provided` format. The project will be determined from the directory provided. It will be removed in Nx v19.
   */
  project?: string;
  style: SupportedStyles;
  directory?: string;
  fileName?: string;
  withTests?: boolean;
  js?: boolean;
  /**
   * @deprecated Provide the `directory` option instead and use the `as-provided` format. This option will be removed in Nx v19.
   */
  flat?: boolean;
  skipFormat?: boolean;
  nameAndDirectoryFormat?: 'as-provided' | 'derived';
}
