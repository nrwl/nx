import { Linter, LinterType } from '@nx/eslint';

export interface StorybookConfigurationSchema {
  project: string;
  interactionTests?: boolean;
  generateStories?: boolean;
  js?: boolean;
  tsConfiguration?: boolean;
  linter?: Linter | LinterType;
  ignorePaths?: string[];
  configureTestRunner?: boolean;
  configureStaticServe?: boolean;
  addPlugin?: boolean;
}
