import { Linter } from '@nx/linter';

export interface StorybookConfigureSchema {
  name: string;
  interactionTests?: boolean;
  generateStories?: boolean;
  js?: boolean;
  tsConfiguration?: boolean;
  linter?: Linter;
  ignorePaths?: string[];
  configureStaticServe?: boolean;
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
