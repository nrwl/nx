import type { Linter, LinterType } from '@nx/eslint';
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
  linter: Linter | LinterType;
  classComponent?: boolean;
  routing?: boolean;
  skipNxJson?: boolean;
  js?: boolean;
  globalCss?: boolean;
  strict?: boolean;
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
  formatter?: 'prettier' | 'none';
  alwaysGenerateProjectJson?: boolean; // this is needed for MF currently
}

export interface NormalizedSchema<T extends Schema = Schema> extends T {
  projectName: string;
  appProjectRoot: string;
  e2eProjectName: string;
  e2eProjectRoot: string;
  parsedTags: string[];
  fileName: string;
  styledModule: null | SupportedStyles;
  hasStyles: boolean;
  unitTestRunner: 'jest' | 'vitest' | 'none';
  addPlugin?: boolean;
  isUsingTsSolutionConfig?: boolean;
}
