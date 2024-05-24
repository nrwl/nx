import type { Meta, StoryObj } from '@storybook/react';
import { TargetConfigurationGroupHeader } from './target-configuration-details-group-header';

const meta: Meta<typeof TargetConfigurationGroupHeader> = {
  component: TargetConfigurationGroupHeader,
  title: 'TargetConfigurationGroupHeader',
};
export default meta;

type Story = StoryObj<typeof TargetConfigurationGroupHeader>;

export const Simple: Story = {
  args: {
    targetGroupName: 'Target Group Name',
    targetsNumber: 5,
  },
};
