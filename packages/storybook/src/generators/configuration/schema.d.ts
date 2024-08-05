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
  addPlugin?: boolean;

  /**
   * @internal
   */
  addExplicitTargets?: boolean;
}
