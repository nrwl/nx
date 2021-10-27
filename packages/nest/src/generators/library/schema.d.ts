import { Linter } from '@nrwl/linter';
import { UnitTestRunner } from '../utils';

export interface LibraryGeneratorOptions {
  name: string;
  buildable?: boolean;
  controller?: boolean;
  directory?: string;
  global?: boolean;
  importPath?: string;
  linter?: Exclude<Linter, Linter.TsLint>;
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
    | 'es2020';
  testEnvironment?: 'jsdom' | 'node';
  unitTestRunner?: UnitTestRunner;
  standaloneConfig?: boolean;
  setParserOptionsProject?: boolean;
  experimentalSwc?: boolean;
}

export interface NormalizedOptions extends LibraryGeneratorOptions {
  fileName: string;
  parsedTags: string[];
  prefix: string;
  projectDirectory: string;
  projectName: string;
  projectRoot: Path;
}
