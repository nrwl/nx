import { Linter } from '@nrwl/workspace';

export interface StorybookConfigureSchema {
  name: string;
  configureCypress: boolean;
  generateStories: boolean;
  generateCypressSpecs: boolean;
  linter: Linter;
  cypressDirectory?: string;
  cypressName?: string;
}
