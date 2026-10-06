import { LinterType } from '@nx/js';

export interface StorybookConfigurationSchema {
  project: string;
  interactionTests?: boolean;
  generateStories?: boolean;
  js?: boolean;
  tsConfiguration?: boolean;
  linter?: LinterType;
  ignorePaths?: string[];
  configureTestRunner?: boolean;
  configureStaticServe?: boolean;
  addPlugin?: boolean;
}
