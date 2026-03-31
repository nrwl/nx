import type { names } from '@nx/devkit';
import type { LinterType } from '@nx/js';
import type { SupportedStyles } from '../../../typings/style';

export interface Schema {
  directory: string;
  name?: string;
  style: SupportedStyles;
  skipFormat?: boolean;
  tags?: string;
  unitTestRunner?: 'jest' | 'vitest' | 'none';
  inSourceTests?: boolean;
  e2eTestRunner: 'cypress' | 'playwright' | 'none';
  linter?: LinterType;
  classComponent?: boolean;
  routing?: boolean;
  useReactRouter?: boolean;
  skipNxJson?: boolean;
  js?: boolean;
  globalCss?: boolean;
  strict?: boolean;
  enableTypedLinting?: boolean;
  /**
   * @deprecated Use `enableTypedLinting` instead. This option will be removed in Nx v24.
   */
  setParserOptionsProject?: boolean;
  compiler?: 'babel' | 'swc';
  remotes?: string[];
  devServerPort?: number;
  skipPackageJson?: boolean;
  rootProject?: boolean;
  bundler?: 'webpack' | 'vite' | 'rspack' | 'rsbuild';
  minimal?: boolean;
  // Internal options
  addPlugin?: boolean;
  nxCloudToken?: string;
  useTsSolution?: boolean;
  formatter?: 'prettier' | 'oxfmt' | 'none';
  useProjectJson?: boolean;
  port?: number;
}

export interface NormalizedSchema<T extends Schema = Schema> extends T {
  // `normalizeOptions` always resolves this, so it is no longer optional.
  linter: LinterType;
  projectName: string;
  appProjectRoot: string;
  e2eProjectName: string;
  e2eProjectRoot: string;
  importPath: string;
  parsedTags: string[];
  fileName: string;
  hasStyles: boolean;
  unitTestRunner: 'jest' | 'vitest' | 'none';
  addPlugin?: boolean;
  names: ReturnType<typeof names>;
  isUsingTsSolutionConfig?: boolean;
}
