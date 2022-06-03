import { Linter } from '@nrwl/linter';

export interface StorybookConfigureSchema {
  name: string;
  generateStories?: boolean;
  js?: boolean;
  tsConfiguration?: boolean;
  linter?: Linter;
  standaloneConfig?: boolean;
}
