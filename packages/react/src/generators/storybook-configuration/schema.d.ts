import { Linter } from '@nrwl/linter';

export interface StorybookConfigureSchema {
  name: string;
  configureCypress: boolean;
  generateStories?: boolean;
  generateCypressSpecs?: boolean;
  js?: boolean;
  tsConfiguration?: boolean;
  linter?: Linter;
  cypressDirectory?: string;
  standaloneConfig?: boolean;
  projectBuildConfig?: string;
}
