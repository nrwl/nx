import type { Linter, LinterType } from '@nx/eslint';

/**
 * Same as the @nx/react library schema, except it removes keys: style, component, routing, appProject
 */
export interface Schema {
  directory: string;
  name?: string;
  skipTsConfig: boolean;
  skipFormat: boolean;
  tags?: string;
  unitTestRunner: 'jest' | 'none';
  linter: Linter | LinterType;
  publishable?: boolean;
  buildable?: boolean;
  importPath?: string;
  js?: boolean;
  strict?: boolean;
  setParserOptionsProject?: boolean;
  skipPackageJson?: boolean; //default is false
  addPlugin?: boolean;
}
