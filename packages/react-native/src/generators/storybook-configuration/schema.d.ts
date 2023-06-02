import { Linter } from '@nx/linter';

export interface StorybookConfigureSchema {
  name: string;
  generateStories?: boolean;
  js?: boolean;
  tsConfiguration?: boolean;
  linter?: Linter;
  standaloneConfig?: boolean;
  ignorePaths?: string[];
}
