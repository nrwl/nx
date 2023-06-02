import { Linter } from '@nx/linter';

/**
 * Same as the @nx/react library schema, except it removes keys: style, component, routing, appProject
 */
export interface Schema {
  name: string;
  directory?: string;
  skipTsConfig: boolean;
  skipFormat: boolean;
  tags?: string;
  pascalCaseFiles?: boolean;
  unitTestRunner: 'jest' | 'none';
  linter: Linter;
  publishable?: boolean;
  buildable?: boolean;
  importPath?: string;
  js?: boolean;
  strict?: boolean;
  setParserOptionsProject?: boolean;
  skipPackageJson?: boolean; //default is false
}
