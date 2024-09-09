import { Linter, LinterType } from '@nx/eslint';

export interface StorybookConfigurationSchema {
  project: string;
  interactionTests?: boolean;
  configureCypress: boolean;
  generateStories?: boolean;
  generateCypressSpecs?: boolean;
  js?: boolean;
  tsConfiguration?: boolean;
  linter?: Linter | LinterType;
  cypressDirectory?: string;
  ignorePaths?: string[];
  configureTestRunner?: boolean;
  configureStaticServe?: boolean;
  addPlugin?: boolean;
}
