import { Linter } from '@nrwl/linter';
import type { SupportedStyles } from '@nrwl/react';

export interface Schema {
  name: string;
  directory?: string;
  style: SupportedStyles;
  skipTsConfig: boolean;
  skipFormat: boolean;
  tags?: string;
  pascalCaseFiles?: boolean;
  routing?: boolean;
  appProject?: string;
  unitTestRunner: 'jest' | 'none';
  linter: Linter;
  component?: boolean;
  publishable?: boolean;
  buildable?: boolean;
  importPath?: string;
  js?: boolean;
  globalCss?: boolean;
  strict?: boolean;
  setParserOptionsProject?: boolean;
  standaloneConfig?: boolean;
}
