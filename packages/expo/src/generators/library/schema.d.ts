import type { Linter, LinterType } from '@nx/eslint';

/**
 * Same as the @nx/react library schema, except it removes keys: style, component, routing, appProject
 */
export interface Schema {
  directory: string;
  name?: string;
  skipTsConfig: boolean; // default is false
  skipFormat: boolean; // default is false
  tags?: string;
  unitTestRunner: 'jest' | 'none';
  linter: Linter | LinterType; // default is eslint
  publishable?: boolean;
  buildable?: boolean;
  importPath?: string;
  js: boolean; // default is false
  strict: boolean; // default is true
  setParserOptionsProject?: boolean;
  skipPackageJson?: boolean; // default is false
  addPlugin?: boolean;
}
