import { ComponentMeta, ComponentStory } from '@storybook/react';
import { CheckboxPanel } from './checkbox-panel';

export default {
  component: CheckboxPanel,
  title: 'Shared/CheckboxPanel',
  argTypes: { checkChanged: { action: 'checkChanged' } },
} as ComponentMeta<typeof CheckboxPanel>;

const Template: ComponentStory<typeof CheckboxPanel> = (args) => (
  <CheckboxPanel {...args} />
);

export const Primary = Template.bind({});
Primary.args = {
  checked: false,
  name: 'option-to-check',
  label: 'Option to check',
  description: 'You can check this option.',
};
