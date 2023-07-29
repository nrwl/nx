export interface CommonNxStorybookConfig {
  uiFramework?:
    | '@storybook/angular'
    | '@storybook/react'
    | '@storybook/html'
    | '@storybook/web-components'
    | '@storybook/vue'
    | '@storybook/vue3'
    | '@storybook/svelte'; // TODO(katerina): Remove when Storybook 7
}

export type UiFramework7 =
  | '@storybook/angular'
  | '@storybook/html-webpack5'
  | '@storybook/nextjs'
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
  | '@storybook/web-components-vite'
  | '@storybook/react-native';
