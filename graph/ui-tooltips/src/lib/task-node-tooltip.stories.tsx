import type { ComponentMeta, ComponentStory } from '@storybook/react';
import { TaskNodeTooltip } from './task-node-tooltip';
import { Tooltip } from './tooltip';

const Story: ComponentMeta<typeof TaskNodeTooltip> = {
  component: TaskNodeTooltip,
  title: 'Tooltips/TaskNodeTooltip',
};
export default Story;

const Template: ComponentStory<typeof TaskNodeTooltip> = (args) => (
  <div className="flex w-full justify-center">
    <Tooltip open={true} content={<TaskNodeTooltip {...args} />}>
      <p>Internal Reference</p>
    </Tooltip>
  </div>
);

export const Primary = Template.bind({});
Primary.args = {
  id: 'my-lib:build',
  executor: '@nrwl/webpack:webpack',
};
