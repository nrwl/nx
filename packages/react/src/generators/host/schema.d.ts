import type { LinterType } from '@nx/js';
import type { SupportedStyles } from '../../../typings/style';

export interface Schema {
  classComponent?: boolean;
  compiler?: 'babel' | 'swc';
  port?: number;
  /** @deprecated Use {@link Schema.port} instead. This option will be removed in Nx v24. */
  devServerPort?: number;
  directory: string;
  e2eTestRunner: 'cypress' | 'playwright' | 'none';
  globalCss?: boolean;
  js?: boolean;
  linter?: LinterType;
  name?: string;
  remotes?: string[];
  enableTypedLinting?: boolean;
  /**
   * @deprecated Use `enableTypedLinting` instead. This option will be removed in Nx v24.
   */
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
  // `normalizeOptions` always resolves this, so it is no longer optional.
  linter: LinterType;
  appProjectRoot: string;
  e2eProjectName: string;
  projectName: string;
  addPlugin?: boolean;
}
