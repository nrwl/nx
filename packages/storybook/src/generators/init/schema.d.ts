import { UiFramework, UiFramework7 } from '../../utils/models';

export interface Schema {
  uiFramework: UiFramework | UiFramework7;
  bundler?: 'webpack' | 'vite'; // TODO(katerina): Remove when Storybook 7
  storybook7Configuration?: boolean;
  js?: boolean;
}
