import type { Meta, StoryObj } from '@storybook/react-webpack5';
import { RankdirPanel } from './rankdir-panel';

const meta: Meta<typeof RankdirPanel> = {
  component: RankdirPanel,
  title: 'Project Graph/RankdirPanel',
};

export default meta;
type Story = StoryObj<typeof RankdirPanel>;

export const Primary: Story = {
  args: {},
};
