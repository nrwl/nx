import { Linter } from '@nrwl/linter';

export interface StorybookConfigureSchema {
  name: string;
  generateStories?: boolean;
  linter?: Linter;
  standaloneConfig?: boolean;
}
