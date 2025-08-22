import type { Meta, StoryObj } from '@storybook/react-webpack5';
import { RankdirPanel } from './rankdir-panel';
import { RankDirProvider } from './rankdir-context';

const meta: Meta<typeof RankdirPanel> = {
  component: RankdirPanel,
  title: 'Project Graph/RankdirPanel',
  decorators: [
    (Story) => (
      <RankDirProvider>
        <Story />
      </RankDirProvider>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof RankdirPanel>;

export const Primary: Story = {
  args: {},
};
