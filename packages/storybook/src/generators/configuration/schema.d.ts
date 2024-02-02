import { Linter } from '@nx/eslint';
import { UiFramework } from '../../utils/models';

export interface StorybookConfigureSchema {
  project: string;
  uiFramework?: UiFramework;
  linter?: Linter;
  js?: boolean;
  interactionTests?: boolean;
  tsConfiguration?: boolean;
  standaloneConfig?: boolean;
  configureStaticServe?: boolean;
  skipFormat?: boolean;
  /**
   * @deprecated Use interactionTests instead. This option will be removed in v19.
   */
  configureCypress?: boolean;
  /**
   * @deprecated Use interactionTests instead. This option will be removed in v19.
   */
  cypressDirectory?: string;
  addPlugin?: boolean;
}
