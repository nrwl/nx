import { Linter } from '@nrwl/linter';
import { SupportedStyles } from '../../../typings/style';

export interface Schema {
  name: string;
  style: SupportedStyles;
  skipFormat: boolean;
  directory?: string;
  tags?: string;
  unitTestRunner: 'jest' | 'none';
  /**
   * @deprecated
   */
  babelJest?: boolean;
  e2eTestRunner: 'cypress' | 'none';
  linter: Linter;
  pascalCaseFiles?: boolean;
  classComponent?: boolean;
  routing?: boolean;
  skipWorkspaceJson?: boolean;
  js?: boolean;
  globalCss?: boolean;
  strict?: boolean;
  setParserOptionsProject?: boolean;
  standaloneConfig?: boolean;
  compiler?: 'babel' | 'swc';
}

export interface NormalizedSchema extends Schema {
  projectName: string;
  appProjectRoot: string;
  e2eProjectName: string;
  parsedTags: string[];
  fileName: string;
  styledModule: null | SupportedStyles;
  hasStyles: boolean;
}
