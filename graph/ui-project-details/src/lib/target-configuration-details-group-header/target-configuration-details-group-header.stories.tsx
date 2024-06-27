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

export const AtomizerCloud: Story = {
  args: {
    targetGroupName: 'Target Group Name',
    targetsNumber: 5,
    nonAtomizedTarget: 'e2e',
    connectedToCloud: true,
  },
};

export const AtomizerNoCloud: Story = {
  args: {
    targetGroupName: 'Target Group Name',
    targetsNumber: 5,
    nonAtomizedTarget: 'e2e',
    connectedToCloud: false,
  },
};
