export interface StorybookConfig {
  configFolder?: string;
  configPath?: string;
  pluginPath?: string;
  srcRoot?: string;
}

export interface CommonNxStorybookConfig {
  uiFramework?: UiFramework;
  uiFramework7?: UiFramework7;
  config: StorybookConfig;
}

export type UiFramework7 =
  | '@storybook/angular'
  | '@storybook/html-webpack5'
  | '@storybook/next'
  | '@storybook/preact-webpack5'
  | '@storybook/react-webpack5'
  | '@storybook/react-vite'
  | '@storybook/server-webpack5'
  | '@storybook/svelte-webpack5'
  | '@storybook/svelte-vite'
  | '@storybook/sveltekit'
  | '@storybook/vue-webpack5'
  | '@storybook/vue-vite'
  | '@storybook/vue3-webpack5'
  | '@storybook/vue3-vite'
  | '@storybook/web-components-webpack5'
  | '@storybook/web-components-vite';

export type UiFramework =
  | '@storybook/angular'
  | '@storybook/react'
  | '@storybook/html'
  | '@storybook/web-components'
  | '@storybook/vue'
  | '@storybook/vue3'
  | '@storybook/svelte'
  | '@storybook/react-native';
