import { Linter } from '@nrwl/linter';

import { SupportedStyles } from '../../../typings';

export interface Schema {
  name: string;
  style: SupportedStyles;
  skipFormat: boolean;
  directory?: string;
  tags?: string;
  unitTestRunner: 'jest' | 'none';
  /**
   * @deprecated
   */
  babelJest?: boolean;
  e2eTestRunner: 'cypress' | 'none';
  linter: Linter;
  pascalCaseFiles?: boolean;
  classComponent?: boolean;
  routing?: boolean;
  skipWorkspaceJson?: boolean;
  js?: boolean;
  globalCss?: boolean;
  strict?: boolean;
  setParserOptionsProject?: boolean;
  standaloneConfig?: boolean;
  compiler?: 'babel' | 'swc';
  host?: string;
  devServerPort?: number;
}
