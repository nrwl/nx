import { Linter } from '@nrwl/workspace';
import { SupportedStyles } from 'packages/react/typings/style';
import { Path } from '@angular-devkit/core';

export interface Schema {
  name: string;
  style?: SupportedStyles;
  skipFormat: boolean;
  directory?: string;
  tags?: string;
  unitTestRunner: 'jest' | 'none';
  babelJest: boolean;
  e2eTestRunner: 'cypress' | 'none';
  linter: Linter;
  pascalCaseFiles?: boolean;
  classComponent?: boolean;
  routing?: boolean;
  skipWorkspaceJson?: boolean;
  js?: boolean;
}

export interface NormalizedSchema extends Schema {
  projectName: string;
  appProjectRoot: Path;
  e2eProjectName: string;
  parsedTags: string[];
  fileName: string;
  styledModule: null | SupportedStyles;
  hasStyles: boolean;
}
