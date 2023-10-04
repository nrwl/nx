import type { ProjectNameAndRootFormat } from '@nx/devkit/src/generators/project-name-and-root-utils';
import type { Linter } from '@nx/linter';
import type { SupportedStyles } from '../../../typings';

export interface Schema {
  classComponent?: boolean;
  compiler?: 'babel' | 'swc';
  devServerPort?: number;
  directory?: string;
  projectNameAndRootFormat?: ProjectNameAndRootFormat;
  e2eTestRunner: 'cypress' | 'none';
  globalCss?: boolean;
  js?: boolean;
  linter: Linter;
  name: string;
  pascalCaseFiles?: boolean;
  remotes?: string[];
  setParserOptionsProject?: boolean;
  skipFormat?: boolean;
  skipNxJson?: boolean;
  ssr?: boolean;
  strict?: boolean;
  style: SupportedStyles;
  tags?: string;
  unitTestRunner: 'jest' | 'vitest' | 'none';
  minimal?: boolean;
  typescriptConfiguration?: boolean;
}

export interface NormalizedSchema extends Schema {
  appProjectRoot: string;
  e2eProjectName: string;
  projectName: string;
}
