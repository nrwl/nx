import type { ProjectNameAndRootFormat } from '@nx/devkit/src/generators/project-name-and-root-utils';
import type { Linter } from '@nx/linter';
import type { SupportedStyles } from '../../../typings';
import type { NormalizedSchema as ApplicationNormalizedSchema } from '../application/schema';

export interface Schema {
  classComponent?: boolean;
  compiler?: 'babel' | 'swc';
  devServerPort?: number;
  directory?: string;
  projectNameAndRootFormat?: ProjectNameAndRootFormat;
  e2eTestRunner: 'cypress' | 'none';
  globalCss?: boolean;
  host?: string;
  js?: boolean;
  linter: Linter;
  name: string;
  pascalCaseFiles?: boolean;
  routing?: boolean;
  setParserOptionsProject?: boolean;
  skipFormat: boolean;
  skipNxJson?: boolean;
  ssr?: boolean;
  strict?: boolean;
  style: SupportedStyles;
  tags?: string;
  unitTestRunner: 'jest' | 'vitest' | 'none';
  typescriptConfiguration?: boolean;
}

export interface NormalizedSchema extends ApplicationNormalizedSchema {
  typescriptConfiguration: boolean;
}
