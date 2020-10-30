import { Linter } from '@nrwl/workspace';
import { SupportedStyles } from 'packages/react/typings/style';

export interface Schema {
  name: string;
  directory?: string;
  style?: SupportedStyles;
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
}
