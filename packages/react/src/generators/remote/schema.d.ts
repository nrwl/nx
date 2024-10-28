import type { Linter, LinterType } from '@nx/eslint';
import type { SupportedStyles } from '../../../typings/style';
import type { NormalizedSchema as ApplicationNormalizedSchema } from '../application/schema';

export interface Schema {
  classComponent?: boolean;
  compiler?: 'babel' | 'swc';
  devServerPort?: number;
  directory: string;
  e2eTestRunner: 'cypress' | 'playwright' | 'none';
  globalCss?: boolean;
  host?: string;
  js?: boolean;
  linter: Linter | LinterType;
  name?: string;
  routing?: boolean;
  setParserOptionsProject?: boolean;
  skipFormat: boolean;
  skipNxJson?: boolean;
  skipPackageJson?: boolean;
  ssr?: boolean;
  strict?: boolean;
  style: SupportedStyles;
  tags?: string;
  unitTestRunner: 'jest' | 'vitest' | 'none';
  typescriptConfiguration?: boolean;
  dynamic?: boolean;
  bundler?: 'rspack' | 'webpack';
}

export interface NormalizedSchema extends ApplicationNormalizedSchema {
  typescriptConfiguration: boolean;
}
