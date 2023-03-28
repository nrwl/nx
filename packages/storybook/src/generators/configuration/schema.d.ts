import { Linter } from '@nrwl/linter';
import { UiFramework7, UiFramework } from '../../utils/models';

export interface StorybookConfigureSchema {
  name: string;
  uiFramework?: UiFramework; // TODO(katerina): Remove when Storybook 7
  configureCypress?: boolean;
  bundler?: 'webpack' | 'vite'; // TODO(katerina): Remove when Storybook 7
  linter?: Linter;
  js?: boolean;
  tsConfiguration?: boolean;
  cypressDirectory?: string;
  standaloneConfig?: boolean;
  configureTestRunner?: boolean;
  configureStaticServe?: boolean;
  storybook7Configuration?: boolean; // TODO(katerina): Change when Storybook 7
  storybook7UiFramework?: UiFramework7; // TODO(katerina): Change when Storybook 7
}
