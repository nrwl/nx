import { Linter } from '@nx/linter';

export interface StorybookConfigureSchema {
  name: string;
  configureCypress: boolean;
  generateStories?: boolean;
  generateCypressSpecs?: boolean;
  js?: boolean;
  tsConfiguration?: boolean;
  linter?: Linter;
  cypressDirectory?: string;
  ignorePaths?: string[];
  bundler?: 'webpack' | 'vite';
  configureTestRunner?: boolean;
  configureStaticServe?: boolean;
  storybook7Configuration?: boolean;
}
