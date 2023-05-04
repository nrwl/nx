import type { Linter } from '@nx/linter';

export interface StorybookConfigurationOptions {
  configureCypress: boolean;
  configureStaticServe?: boolean;
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
