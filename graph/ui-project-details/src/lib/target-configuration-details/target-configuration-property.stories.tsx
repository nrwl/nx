import type { Meta, StoryObj } from '@storybook/react';
import {
  TargetConfigurationProperty,
  RenderPropertyProps,
} from './target-configuration-property';

const meta: Meta<typeof TargetConfigurationProperty> = {
  component: TargetConfigurationProperty,
  title: 'ProjectDetails/TargetConfigurationProperty',
};

export default meta;
type Story = StoryObj<typeof TargetConfigurationProperty>;

export const Primary: Story = {
  args: {
    data: 'default',
  } as RenderPropertyProps,
  render: (args: RenderPropertyProps) => (
    <TargetConfigurationProperty {...args} />
  ),
};

export const Array: Story = {
  args: {
    data: ['default', 'general', 'external'],
  } as RenderPropertyProps,
  render: (args: RenderPropertyProps) => (
    <TargetConfigurationProperty {...args} />
  ),
};

export const Record: Story = {
  args: {
    data: { env: 'production', platform: 'linux' },
  } as RenderPropertyProps,
  render: (args: RenderPropertyProps) => (
    <TargetConfigurationProperty {...args} />
  ),
};
