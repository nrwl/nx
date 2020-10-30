import { Linter } from '@nrwl/workspace';

export interface StorybookConfigureSchema {
  name: string;
  uiFramework: '@storybook/angular' | '@storybook/react';
  configureCypress: boolean;
  linter?: Linter;
  js?: boolean;
}
