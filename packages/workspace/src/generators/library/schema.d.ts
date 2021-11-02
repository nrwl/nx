// nx-ignore-next-line
const { Linter } = require('@nrwl/linter');

export interface Schema {
  name: string;
  directory?: string;
  skipTsConfig?: boolean;
  skipFormat?: boolean;
  tags?: string;
  simpleModuleName?: boolean;
  unitTestRunner?: 'jest' | 'none';
  linter?: Linter;
  testEnvironment?: 'jsdom' | 'node';
  importPath?: string;
  js?: boolean;
  babelJest?: boolean;
  pascalCaseFiles?: boolean;
  strict?: boolean;
  skipBabelrc?: boolean;
  buildable?: boolean;
  setParserOptionsProject?: boolean;
  standaloneConfig?: boolean;
}
