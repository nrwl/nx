import { Linter } from '@nrwl/linter';
import { SupportedStyles } from '../../../typings/style';

export interface Schema {
  appProject?: string;
  buildable?: boolean;
  bundler?: 'rollup' | 'vite';
  compiler?: 'babel' | 'swc';
  component?: boolean;
  directory?: string;
  globalCss?: boolean;
  importPath?: string;
  inSourceTests?: boolean;
  js?: boolean;
  linter: Linter;
  name: string;
  pascalCaseFiles?: boolean;
  publishable?: boolean;
  routing?: boolean;
  setParserOptionsProject?: boolean;
  skipFormat?: boolean;
  skipPackageJson?: boolean;
  skipTsConfig?: boolean;
  standaloneConfig?: boolean;
  strict?: boolean;
  style: SupportedStyles;
  tags?: string;
  unitTestRunner?: 'jest' | 'vitest' | 'none';
}
