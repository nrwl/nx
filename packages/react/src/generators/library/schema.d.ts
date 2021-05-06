import { SupportedStyles } from '../../../typings/style';
import { Linter } from '@nrwl/linter';

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
}
