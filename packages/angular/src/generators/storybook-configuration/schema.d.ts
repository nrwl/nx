import type { Linter } from '@nrwl/linter';

export interface StorybookConfigurationOptions {
  configureCypress: boolean;
  generateCypressSpecs: boolean;
  generateStories: boolean;
  linter: Linter;
  name: string;
  cypressDirectory?: string;
  tsConfiguration?: boolean;
  skipFormat?: boolean;
  ignorePaths?: string[];
  configureTestRunner?: boolean;
}
