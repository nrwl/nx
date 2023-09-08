import type { Meta, StoryObj } from '@storybook/react';
import { Dropdown } from './dropdown';

const meta: Meta<typeof Dropdown> = {
  component: Dropdown,
  title: 'Shared/Dropdown',
  argTypes: {
    onChange: { action: 'onChange' },
  },
};

export default meta;
type Story = StoryObj<typeof Dropdown>;

export const Primary: Story = {
  render: () => (
    <Dropdown {...{}}>
      <option value="Option 1">Option 1</option>
      <option value="Option 2">Option 2</option>
    </Dropdown>
  ),
};
