import type { Meta, StoryObj } from '@storybook/react';
import { FocusedPanel } from './focused-panel';

const meta: Meta<typeof FocusedPanel> = {
  component: FocusedPanel,
  title: 'Project Graph/FocusedProjectPanel',
  argTypes: { resetFocus: { action: 'resetFocus' } },
};

export default meta;
type Story = StoryObj<typeof FocusedPanel>;

export const Primary: Story = {
  args: {
    focusedLabel: 'store',
  },
};
