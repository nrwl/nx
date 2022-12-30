import { Linter } from '@nrwl/linter';

export interface StorybookConfigureSchema {
  name: string;
  uiFramework:
    | '@storybook/angular'
    | '@storybook/react'
    | '@storybook/react-native'
    | '@storybook/html'
    | '@storybook/web-components'
    | '@storybook/vue'
    | '@storybook/vue3'
    | '@storybook/svelte';
  configureCypress?: boolean;
  bundler?: 'webpack' | 'vite';
  linter?: Linter;
  js?: boolean;
  tsConfiguration?: boolean;
  cypressDirectory?: string;
  standaloneConfig?: boolean;
  configureTestRunner?: boolean;
}
