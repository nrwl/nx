import { ComponentStory, ComponentMeta } from '@storybook/react';
import {
  ProjectNodeToolTip,
  ProjectNodeToolTipProps,
} from './project-node-tooltip';
import Tippy from '@tippyjs/react';

export default {
  component: ProjectNodeToolTip,
  title: 'Tooltips/ProjectNodeToolTip',
} as ComponentMeta<typeof ProjectNodeToolTip>;

const Template: ComponentStory<typeof ProjectNodeToolTip> = (args) => (
  <Tippy
    content={<ProjectNodeToolTip {...args} />}
    visible={true}
    theme="nx"
    interactive={true}
    maxWidth="none"
  >
    <p></p>
  </Tippy>
);

export const Primary = Template.bind({});
const args: ProjectNodeToolTipProps = {
  type: 'app',
  tags: ['type:app', 'scope:store'],
  id: 'store',
};
Primary.args = args;
