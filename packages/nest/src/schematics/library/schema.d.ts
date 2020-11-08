import { Linter } from '@nrwl/workspace';

export interface Schema {
  name: string;
  directory?: string;
  skipTsConfig: boolean;
  skipFormat: boolean;
  tags?: string;
  unitTestRunner: 'jest' | 'none';
  linter: Linter;
  buildable: boolean;
  publishable?: boolean;
  global?: boolean;
  service?: boolean;
  controller?: boolean;
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
  testEnvironment: 'jsdom' | 'node';
  strict: boolean;
}
