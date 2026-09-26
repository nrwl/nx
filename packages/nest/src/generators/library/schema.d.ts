import type { LinterType } from '@nx/js';
import type { UnitTestRunner } from '../utils';

export interface LibraryGeneratorOptions {
  directory: string;
  name?: string;
  buildable?: boolean;
  controller?: boolean;
  global?: boolean;
  importPath?: string;
  linter?: LinterType;
  publishable?: boolean;
  service?: boolean;
  skipFormat?: boolean;
  skipTsConfig?: boolean;
  strict?: boolean;
  tags?: string;
  target?:
    | 'es5'
    | 'es6'
    | 'esnext'
    | 'es2015'
    | 'es2016'
    | 'es2017'
    | 'es2018'
    | 'es2019'
    | 'es2020'
    | 'es2021';
  testEnvironment?: 'jsdom' | 'node';
  unitTestRunner?: UnitTestRunner;
  enableTypedLinting?: boolean;
  /**
   * @deprecated Use `enableTypedLinting` instead. This option will be removed in Nx v24.
   */
  setParserOptionsProject?: boolean;
  skipPackageJson?: boolean;
  addPlugin?: boolean;
  isUsingTsSolutionsConfig?: boolean;
  useProjectJson?: boolean;
}

export interface NormalizedOptions extends LibraryGeneratorOptions {
  fileName: string;
  parsedTags: string[];
  prefix: string;
  projectName: string;
  projectRoot: Path;
}
