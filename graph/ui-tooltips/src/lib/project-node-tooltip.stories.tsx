import type { Meta, StoryObj } from '@storybook/react';
import {
  ProjectNodeToolTip,
  ProjectNodeToolTipProps,
} from './project-node-tooltip';
import { Tooltip } from './tooltip';

const meta: Meta<typeof ProjectNodeToolTip> = {
  component: ProjectNodeToolTip,
  title: 'Tooltips/ProjectNodeToolTip',
};

export default meta;
type Story = StoryObj<typeof ProjectNodeToolTip>;

export const Primary: Story = {
  render: (args) => (
    <div className="flex w-full justify-center">
      <Tooltip open={true} content={(<ProjectNodeToolTip {...args} />) as any}>
        <p>Internal Reference</p>
      </Tooltip>
    </div>
  ),
  args: {
    type: 'app',
    tags: ['type:app', 'scope:store'],
    id: 'store',
  } as ProjectNodeToolTipProps,
};
