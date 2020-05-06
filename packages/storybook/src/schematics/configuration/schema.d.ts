import { Linter } from '@nrwl/workspace';

export interface StorybookConfigureSchema {
  name: string;
  uiFramework: string;
  configureCypress: boolean;
  linter: Linter;
  js?: boolean;
}
