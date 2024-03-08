import type { Meta, StoryObj } from '@storybook/react';
import { Pill } from './pill';

const meta: Meta<typeof Pill> = {
  component: Pill,
  title: 'Shared/Pill',
};

export default meta;
type Story = StoryObj<typeof Pill>;

export const Primary: Story = {
  args: {
    text: 'Pill Text',
    color: 'grey',
    tooltip: 'Pill Tooltip',
  },
};
