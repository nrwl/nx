import type { Linter, LinterType } from '@nx/eslint';
import type { SupportedStyles } from '../../../typings/style';

export interface Schema {
  classComponent?: boolean;
  compiler?: 'babel' | 'swc';
  devServerPort?: number;
  directory: string;
  e2eTestRunner: 'cypress' | 'playwright' | 'none';
  globalCss?: boolean;
  js?: boolean;
  linter: Linter | LinterType;
  name?: string;
  remotes?: string[];
  setParserOptionsProject?: boolean;
  skipFormat?: boolean;
  skipNxJson?: boolean;
  skipPackageJson?: boolean;
  ssr?: boolean;
  strict?: boolean;
  style: SupportedStyles;
  tags?: string;
  unitTestRunner: 'jest' | 'vitest' | 'none';
  minimal?: boolean;
  typescriptConfiguration?: boolean;
  dynamic?: boolean;
  addPlugin?: boolean;
  bundler?: 'rspack' | 'webpack';
}

export interface NormalizedSchema extends Schema {
  appProjectRoot: string;
  e2eProjectName: string;
  projectName: string;
  addPlugin?: boolean;
}
