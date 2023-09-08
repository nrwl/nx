import type { Meta, StoryObj } from '@storybook/react';
import { CheckboxPanel } from './checkbox-panel';

const meta: Meta<typeof CheckboxPanel> = {
  component: CheckboxPanel,
  title: 'Shared/CheckboxPanel',
  argTypes: { checkChanged: { action: 'checkChanged' } },
};

export default meta;
type Story = StoryObj<typeof CheckboxPanel>;

export const Primary: Story = {
  args: {
    checked: false,
    name: 'option-to-check',
    label: 'Option to check',
    description: 'You can check this option.',
  },
};
