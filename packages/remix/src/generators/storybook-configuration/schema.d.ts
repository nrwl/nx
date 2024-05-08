import { Linter } from '@nx/eslint';

export interface StorybookConfigurationSchema {
  project: string;
  configureCypress: boolean;
  generateStories?: boolean;
  generateCypressSpecs?: boolean;
  js?: boolean;
  tsConfiguration?: boolean;
  linter?: Linter;
  cypressDirectory?: string;
  ignorePaths?: string[];
  configureTestRunner?: boolean;
  configureStaticServe?: boolean;
  addPlugin?: boolean;
}
