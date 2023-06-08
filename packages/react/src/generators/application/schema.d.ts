import { Linter } from '@nx/linter';
import { SupportedStyles } from '../../../typings/style';

export interface Schema {
  name: string;
  style: SupportedStyles;
  skipFormat?: boolean;
  directory?: string;
  tags?: string;
  unitTestRunner?: 'jest' | 'vitest' | 'none';
  inSourceTests?: boolean;
  e2eTestRunner: 'cypress' | 'none';
  linter: Linter;
  pascalCaseFiles?: boolean;
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
  bundler?: 'webpack' | 'vite' | 'rspack';
  minimal?: boolean;
}

export interface NormalizedSchema<T extends Schema = Schema> extends T {
  projectName: string;
  appProjectRoot: string;
  e2eProjectName: string;
  parsedTags: string[];
  fileName: string;
  styledModule: null | SupportedStyles;
  hasStyles: boolean;
  unitTestRunner: 'jest' | 'vitest' | 'none';
}
