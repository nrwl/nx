export interface CreatePackageSchema {
  name: string;
  project: string;

  // options to create cli package, passed to js library generator
  directory?: string;
  skipTsConfig: boolean;
  skipFormat: boolean;
  tags?: string;
  unitTestRunner: 'jest' | 'none';
  linter: Linter;
  setParserOptionsProject?: boolean;
  compiler: 'swc' | 'tsc';
  importPath?: string;
  rootProject?: boolean;
}
