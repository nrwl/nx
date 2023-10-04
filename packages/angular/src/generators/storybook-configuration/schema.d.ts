import type { Linter } from '@nx/linter';

export interface StorybookConfigurationOptions {
  configureStaticServe?: boolean;
  generateStories: boolean;
  linter: Linter;
  name: string;
  tsConfiguration?: boolean;
  skipFormat?: boolean;
  ignorePaths?: string[];
  interactionTests?: boolean;
  configureCypress?: boolean;
  generateCypressSpecs?: boolean;
  cypressDirectory?: string;
}
