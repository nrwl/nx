import { LinterType } from '@nx/js';

export interface StorybookConfigureSchema {
  project: string;
  interactionTests?: boolean;
  generateStories?: boolean;
  js?: boolean;
  tsConfiguration?: boolean;
  linter?: LinterType;
  ignorePaths?: string[];
  configureStaticServe?: boolean;
  addPlugin?: boolean;
}
