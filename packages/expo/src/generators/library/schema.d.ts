import type { LinterType } from '@nx/js';

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
  linter?: LinterType;
  publishable?: boolean;
  buildable?: boolean;
  importPath?: string;
  js: boolean; // default is false
  strict: boolean; // default is true
  enableTypedLinting?: boolean;
  skipPackageJson?: boolean; // default is false
  useProjectJson?: boolean;
}
