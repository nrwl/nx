import type { ComponentStory, ComponentMeta } from '@storybook/react';
import { TaskNodeTooltip } from './task-node-tooltip';
import Tippy from '@tippyjs/react';

const Story: ComponentMeta<typeof TaskNodeTooltip> = {
  component: TaskNodeTooltip,
  title: 'Tooltips/TaskNodeTooltip',
};
export default Story;

const Template: ComponentStory<typeof TaskNodeTooltip> = (args) => (
  <Tippy
    content={<TaskNodeTooltip {...args} />}
    visible={true}
    theme="nx"
    interactive={true}
    maxWidth="none"
  >
    <p></p>
  </Tippy>
);

export const Primary = Template.bind({});
Primary.args = {
  id: 'my-lib:build',
  executor: '@nrwl/webpack:webpack',
};
