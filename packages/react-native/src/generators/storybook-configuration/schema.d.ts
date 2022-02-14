import { Linter } from '@nrwl/linter';

export interface StorybookConfigureSchema {
  name: string;
  generateStories?: boolean;
  js?: boolean;
  linter?: Linter;
  standaloneConfig?: boolean;
}
