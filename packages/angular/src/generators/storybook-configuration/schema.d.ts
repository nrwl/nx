import type { Linter, LinterType } from '@nx/eslint';

export interface StorybookConfigurationOptions {
  configureStaticServe?: boolean;
  generateStories: boolean;
  linter: Linter | LinterType;
  project: string;
  tsConfiguration?: boolean;
  skipFormat?: boolean;
  ignorePaths?: string[];
  interactionTests?: boolean;
}
