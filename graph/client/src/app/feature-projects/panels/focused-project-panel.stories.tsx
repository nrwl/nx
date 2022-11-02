import { ComponentStory, ComponentMeta } from '@storybook/react';
import {
  FocusedProjectPanel,
  FocusedProjectPanelProps,
} from './focused-project-panel';

export default {
  component: FocusedProjectPanel,
  title: 'Project Graph/FocusedProjectPanel',
  argTypes: { resetFocus: { action: 'resetFocus' } },
} as ComponentMeta<typeof FocusedProjectPanel>;

const Template: ComponentStory<typeof FocusedProjectPanel> = (args) => (
  <FocusedProjectPanel {...args} />
);

export const Primary = Template.bind({});
Primary.args = {
  focusedProject: 'store',
};
