import { Linter, LinterType } from '@nx/eslint';
import { UiFramework } from '../../utils/models';

export interface StorybookConfigureSchema {
  project: string;
  uiFramework?: UiFramework;
  linter?: Linter | LinterType;
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
