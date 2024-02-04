import type { ProjectNameAndRootFormat } from '@nx/devkit/src/generators/project-name-and-root-utils';
import type { Linter } from '@nx/eslint';

/**
 * Same as the @nx/react library schema, except it removes keys: style, component, routing, appProject
 */
export interface Schema {
  name: string;
  directory?: string;
  projectNameAndRootFormat?: ProjectNameAndRootFormat;
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
  addPlugin?: boolean;
}
