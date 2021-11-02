import { Linter } from '@nrwl/linter';

/**
 * Same as the @nrwl/react library schema, except it removes keys: style, component, routing, appProject
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
  globalCss?: boolean;
  strict?: boolean;
  setParserOptionsProject?: boolean;
}
