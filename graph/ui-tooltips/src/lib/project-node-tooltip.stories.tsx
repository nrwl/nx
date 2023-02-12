import { ComponentMeta, ComponentStory } from '@storybook/react';
import {
  ProjectNodeToolTip,
  ProjectNodeToolTipProps,
} from './project-node-tooltip';
import { Tooltip } from './tooltip';

export default {
  component: ProjectNodeToolTip,
  title: 'Tooltips/ProjectNodeToolTip',
} as ComponentMeta<typeof ProjectNodeToolTip>;

const Template: ComponentStory<typeof ProjectNodeToolTip> = (args) => (
  <div className="flex w-full justify-center">
    <Tooltip open={true} content={<ProjectNodeToolTip {...args} />}>
      <p>Internal Reference</p>
    </Tooltip>
  </div>
);

export const Primary = Template.bind({});
const args: ProjectNodeToolTipProps = {
  type: 'app',
  tags: ['type:app', 'scope:store'],
  id: 'store',
};
Primary.args = args;
