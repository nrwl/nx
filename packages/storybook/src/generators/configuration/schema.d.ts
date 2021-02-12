import { Linter } from '@nrwl/linter';

export interface StorybookConfigureSchema {
  name: string;
  uiFramework: '@storybook/angular' | '@storybook/react';
  configureCypress?: boolean;
  linter?: Linter;
  js?: boolean;
}
