import { Linter } from '@nx/eslint';

export interface StorybookConfigureSchema {
  project: string;
  interactionTests?: boolean;
  generateStories?: boolean;
  js?: boolean;
  tsConfiguration?: boolean;
  linter?: Linter;
  ignorePaths?: string[];
  configureStaticServe?: boolean;
  addPlugin?: boolean;
}
