import { LinterType } from '@nx/js';
import { UiFramework } from '../../utils/models';

export interface StorybookConfigureSchema {
  project: string;
  uiFramework?: UiFramework;
  linter?: LinterType;
  js?: boolean;
  interactionTests?: boolean;
  tsConfiguration?: boolean;
  configureStaticServe?: boolean;
  skipFormat?: boolean;
  addPlugin?: boolean;

  /**
   * @internal
   */
  addExplicitTargets?: boolean;
}
