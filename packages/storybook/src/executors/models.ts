export interface StorybookConfig {
  configFolder?: string;
  configPath?: string;
  pluginPath?: string;
  srcRoot?: string;
}

export interface CommonNxStorybookConfig {
  uiFramework:
    | '@storybook/angular'
    | '@storybook/react'
    | '@storybook/html'
    | '@storybook/web-components'
    | '@storybook/vue'
    | '@storybook/vue3';
  projectBuildConfig?: string;
  config: StorybookConfig;
}
