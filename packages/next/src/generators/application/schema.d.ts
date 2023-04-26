import { Linter } from '@nx/linter';
import { SupportedStyles } from '@nx/react';

export interface Schema {
  name: string;
  style?: SupportedStyles;
  skipFormat?: boolean;
  directory?: string;
  tags?: string;
  unitTestRunner?: 'jest' | 'none';
  e2eTestRunner?: 'cypress' | 'none';
  linter?: Linter;
  js?: boolean;
  setParserOptionsProject?: boolean;
  swc?: boolean;
  customServer?: boolean;
  skipPackageJson?: boolean;
  appDir?: boolean;
  rootProject?: boolean;
}
