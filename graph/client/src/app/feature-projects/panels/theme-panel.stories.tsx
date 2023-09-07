import type { Meta, StoryObj } from '@storybook/react';
import { ThemePanel } from './theme-panel';

const meta: Meta<typeof ThemePanel> = {
  component: ThemePanel,
  title: 'Project Graph/ThemePanel',
};

export default meta;
type Story = StoryObj<typeof ThemePanel>;

export const Primary: Story = {
  args: {},
};
