import { Linter } from '@nx/linter';

export interface StorybookConfigureSchema {
  name: string;
  interactionTests?: boolean;
  generateStories?: boolean;
  configureCypress?: boolean;
  generateCypressSpecs?: boolean;
  js?: boolean;
  tsConfiguration?: boolean;
  linter?: Linter;
  cypressDirectory?: string;
  ignorePaths?: string[];
  configureStaticServe?: boolean;
}
