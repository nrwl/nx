import type { Meta, StoryObj } from '@storybook/react';
import { TracingPanel } from './tracing-panel';

const meta: Meta<typeof TracingPanel> = {
  component: TracingPanel,
  title: 'Project Graph/TracingPanel',
  argTypes: {
    resetEnd: { action: 'resetEnd' },
    resetStart: { action: 'resetStart' },
    setAlgorithm: { action: 'setAlgorithm' },
  },
};

export default meta;
type Story = StoryObj<typeof TracingPanel>;

export const Primary: Story = {
  args: {
    end: 'shared-ui',
    start: 'store',
    algorithm: 'shortest',
  },
};
