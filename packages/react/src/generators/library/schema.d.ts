import type { Linter } from '@nx/linter';
import { SupportedStyles } from '../../../typings/style';

export interface Schema {
  appProject?: string;
  buildable?: boolean;
  bundler?: 'none' | 'rollup' | 'vite';
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
  strict?: boolean;
  style: SupportedStyles;
  tags?: string;
  unitTestRunner?: 'jest' | 'vitest' | 'none';
  minimal?: boolean;
  simpleName?: boolean;
}

export interface NormalizedSchema extends Schema {
  js: boolean;
  name: string;
  fileName: string;
  projectRoot: string;
  routePath: string;
  projectDirectory: string;
  parsedTags: string[];
  appMain?: string;
  appSourceRoot?: string;
  libsDir?: string;
  unitTestRunner: 'jest' | 'vitest' | 'none';
}
