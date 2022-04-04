import { Linter } from '@nrwl/linter';

export interface StorybookConfigureSchema {
  name: string;
  uiFramework:
    | '@storybook/angular'
    | '@storybook/react'
    | '@storybook/react-native';
  configureCypress?: boolean;
  linter?: Linter;
  js?: boolean;
  cypressDirectory?: string;
  standaloneConfig?: boolean;
  projectBuildConfig?: string;
}
