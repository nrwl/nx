import type { ProjectNameAndRootFormat } from '@nx/devkit/src/generators/project-name-and-root-utils';
import type { Linter } from '@nx/eslint';
import type { SupportedStyles } from '@nx/react';

export interface Schema {
  name: string;
  directory?: string;
  projectNameAndRootFormat?: ProjectNameAndRootFormat;
  style: SupportedStyles;
  skipTsConfig?: boolean;
  skipFormat?: boolean;
  tags?: string;
  pascalCaseFiles?: boolean;
  routing?: boolean;
  appProject?: string;
  unitTestRunner: 'jest' | 'none';
  linter: Linter;
  component?: boolean;
  publishable?: boolean;
  buildable?: boolean;
  importPath?: string;
  js?: boolean;
  globalCss?: boolean;
  strict?: boolean;
  setParserOptionsProject?: boolean;
  skipPackageJson?: boolean;
  addPlugin?: boolean;
}
