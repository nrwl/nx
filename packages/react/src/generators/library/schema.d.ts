import type { Linter, LinterType } from '@nx/eslint';
import type { SupportedStyles } from '../../../typings/style';

export interface Schema {
  appProject?: string;
  buildable?: boolean;
  bundler?: 'none' | 'rollup' | 'vite';
  compiler?: 'babel' | 'swc';
  component?: boolean;
  directory: string;
  globalCss?: boolean;
  importPath?: string;
  inSourceTests?: boolean;
  js?: boolean;
  linter: Linter | LinterType;
  name?: string;
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
  addPlugin?: boolean;
  useProjectJson?: boolean;
}

export interface NormalizedSchema extends Schema {
  js: boolean;
  name: string;
  fileName: string;
  projectRoot: string;
  routePath: string;
  parsedTags: string[];
  importPath: string;
  appMain?: string;
  appSourceRoot?: string;
  unitTestRunner: 'jest' | 'vitest' | 'none';
  isUsingTsSolutionConfig?: boolean;
}
