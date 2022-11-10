import { ComponentMeta, ComponentStory } from '@storybook/react';
import { Dropdown } from './dropdown';

export default {
  component: Dropdown,
  title: 'Shared/Dropdown',
  argTypes: {
    onChange: { action: 'onChange' },
  },
} as ComponentMeta<typeof Dropdown>;

const Template: ComponentStory<typeof Dropdown> = (args) => (
  <Dropdown {...args}>
    <option value="Option 1">Option 1</option>
    <option value="Option 2">Option 2</option>
  </Dropdown>
);

export const Primary = Template.bind({});
Primary.args = {};
