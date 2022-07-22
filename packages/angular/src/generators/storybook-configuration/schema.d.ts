import type { Linter } from '@nrwl/linter';

export interface StorybookConfigurationOptions {
  configureCypress: boolean;
  generateCypressSpecs: boolean;
  generateStories: boolean;
  linter: Exclude<Linter, Linter.TsLint>;
  name: string;
  cypressDirectory?: string;
  tsConfiguration?: boolean;
  skipFormat?: boolean;
}
