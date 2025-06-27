import type { Meta, StoryObj } from '@storybook/react-webpack5';
import { CollapseEdgesPanel } from './collapse-edges-panel';

const meta: Meta<typeof CollapseEdgesPanel> = {
  component: CollapseEdgesPanel,
  title: 'Project Graph/CollapseEdgesPanel',
  argTypes: {
    collapseEdges: Boolean,
    collapseEdgesChanged: { action: 'collapseEdgesChanged' },
  },
};

export default meta;
type Story = StoryObj<typeof CollapseEdgesPanel>;

export const Primary: Story = {
  args: {
    collapseEdges: false,
  },
};
