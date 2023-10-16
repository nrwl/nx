import { Linter } from '@nx/eslint';
import { UiFramework } from '../../utils/models';

export interface StorybookConfigureSchema {
  name: string;
  uiFramework?: UiFramework;
  linter?: Linter;
  js?: boolean;
  interactionTests?: boolean;
  tsConfiguration?: boolean;
  standaloneConfig?: boolean;
  configureStaticServe?: boolean;
  skipFormat?: boolean;
  /**
   * @deprecated Use interactionTests instead. This option will be removed in v18.
   */
  configureCypress?: boolean;
  /**
   * @deprecated Use interactionTests instead. This option will be removed in v18.
   */
  cypressDirectory?: string;
}
