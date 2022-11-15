import { ComponentMeta, ComponentStory } from '@storybook/react';
import { FocusedPanel } from './focused-panel';

export default {
  component: FocusedPanel,
  title: 'Project Graph/FocusedProjectPanel',
  argTypes: { resetFocus: { action: 'resetFocus' } },
} as ComponentMeta<typeof FocusedPanel>;

const Template: ComponentStory<typeof FocusedPanel> = (args) => (
  <FocusedPanel {...args} />
);

export const Primary = Template.bind({});
Primary.args = {
  focusedProject: 'store',
};
