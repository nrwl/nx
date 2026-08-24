import type { LinterType } from '@nx/js';
import type { SupportedStyles } from '../../../typings/style';
import type { NormalizedSchema as ApplicationNormalizedSchema } from '../application/schema';

export interface Schema {
  classComponent?: boolean;
  compiler?: 'babel' | 'swc';
  port?: number;
  /** @deprecated Use {@link Schema.port} instead. This option will be removed in Nx v24. */
  devServerPort?: number;
  directory: string;
  e2eTestRunner: 'cypress' | 'playwright' | 'none';
  globalCss?: boolean;
  host?: string;
  js?: boolean;
  linter?: LinterType;
  name?: string;
  routing?: boolean;
  enableTypedLinting?: boolean;
  /**
   * @deprecated Use `enableTypedLinting` instead. This option will be removed in Nx v24.
   */
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
