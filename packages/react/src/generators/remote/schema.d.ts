import { Linter } from '@nx/linter';

import { SupportedStyles } from '../../../typings';

export interface Schema {
  classComponent?: boolean;
  compiler?: 'babel' | 'swc';
  devServerPort?: number;
  directory?: string;
  e2eTestRunner: 'cypress' | 'none';
  globalCss?: boolean;
  host?: string;
  js?: boolean;
  linter: Linter;
  name: string;
  pascalCaseFiles?: boolean;
  routing?: boolean;
  setParserOptionsProject?: boolean;
  skipFormat: boolean;
  skipNxJson?: boolean;
  ssr?: boolean;
  strict?: boolean;
  style: SupportedStyles;
  tags?: string;
  unitTestRunner: 'jest' | 'vitest' | 'none';
}
