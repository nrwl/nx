export interface Schema {
  uiFramework:
    | '@storybook/angular'
    | '@storybook/react'
    | '@storybook/html'
    | '@storybook/web-components'
    | '@storybook/vue'
    | '@storybook/vue3'
    | '@storybook/svelte'
    | '@storybook/react-native';
}
