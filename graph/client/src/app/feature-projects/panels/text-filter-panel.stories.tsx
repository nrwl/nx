import type { Meta, StoryObj } from '@storybook/react';
import { TextFilterPanel } from './text-filter-panel';

const meta: Meta<typeof TextFilterPanel> = {
  component: TextFilterPanel,
  title: 'Project Graph/TextFilterPanel',
  argTypes: {
    resetTextFilter: { action: 'resetTextFilter' },
    toggleIncludeLibsInPathChange: {
      action: 'toggleIncludeLibsInPathChange',
    },
    updateTextFilter: {
      action: 'updateTextFilter',
    },
  },
};

export default meta;
type Story = StoryObj<typeof TextFilterPanel>;

export const Primary: Story = {
  args: {
    includePath: false,
    textFilter: 'some-lib',
  },
};
