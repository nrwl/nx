import type { Meta, StoryObj } from '@storybook/react';
import { TaskNodeTooltip } from './task-node-tooltip';
import { Tooltip } from './tooltip';

const meta: Meta<typeof TaskNodeTooltip> = {
  component: TaskNodeTooltip,
  title: 'Tooltips/TaskNodeTooltip',
};

export default meta;
type Story = StoryObj<typeof TaskNodeTooltip>;

export const Primary: Story = {
  args: {
    id: 'my-lib:build',
    executor: '@nrwl/webpack:webpack',
  },
  render: (args) => (
    <div className="flex w-full justify-center">
      <Tooltip open={true} content={(<TaskNodeTooltip {...args} />) as any}>
        <p>Internal Reference</p>
      </Tooltip>
    </div>
  ),
};
