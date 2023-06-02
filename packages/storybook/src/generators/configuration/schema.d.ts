import { Linter } from '@nx/linter';
import { UiFramework7, UiFramework } from '../../utils/models';

export interface StorybookConfigureSchema {
  name: string;
  uiFramework?: UiFramework7;
  configureCypress?: boolean;
  linter?: Linter;
  js?: boolean;
  tsConfiguration?: boolean;
  cypressDirectory?: string;
  standaloneConfig?: boolean;
  configureTestRunner?: boolean;
  configureStaticServe?: boolean;
  skipFormat?: boolean;
}
