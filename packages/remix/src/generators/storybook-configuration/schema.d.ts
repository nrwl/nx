import { Linter } from '@nx/eslint';

export interface StorybookConfigurationSchema {
  project: string;
  generateStories?: boolean;
  js?: boolean;
  tsConfiguration?: boolean;
  linter?: Linter;
  ignorePaths?: string[];
  configureTestRunner?: boolean;
  configureStaticServe?: boolean;
  addPlugin?: boolean;
}
