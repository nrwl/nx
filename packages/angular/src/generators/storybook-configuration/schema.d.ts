import type { Linter } from '@nx/linter';

export interface StorybookConfigurationOptions {
  configureStaticServe?: boolean;
  generateStories: boolean;
  linter: Linter;
  name: string;
  tsConfiguration?: boolean;
  skipFormat?: boolean;
  ignorePaths?: string[];
  interactionTests?: boolean;
  /**
   * @deprecated Use interactionTests instead. This option will be removed in v18.
   */
  configureCypress?: boolean;
  /**
   * @deprecated Use interactionTests instead. This option will be removed in v18.
   */
  generateCypressSpecs?: boolean;
  /**
   * @deprecated Use interactionTests instead. This option will be removed in v18.
   */
  cypressDirectory?: string;
}
