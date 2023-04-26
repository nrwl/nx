import { Linter } from '@nx/linter';

/**
 * Same as the @nx/react library schema, except it removes keys: style, component, routing, appProject
 */
export interface Schema {
  name: string;
  directory?: string;
  skipTsConfig: boolean; // default is false
  skipFormat: boolean; // default is false
  tags?: string;
  pascalCaseFiles?: boolean;
  unitTestRunner: 'jest' | 'none';
  linter: Linter; // default is eslint
  publishable?: boolean;
  buildable?: boolean;
  importPath?: string;
  js: boolean; // default is false
  strict: boolean; // default is true
  setParserOptionsProject?: boolean;
  skipPackageJson?: boolean; // default is false
}
