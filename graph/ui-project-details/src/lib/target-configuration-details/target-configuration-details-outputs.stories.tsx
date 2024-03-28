import type { Meta, StoryObj } from '@storybook/react';
import {
  TargetConfigurationDetailsOutputs,
  TargetConfigurationDetailsOutputsProps,
} from './target-configuration-details-outputs';

const meta: Meta<typeof TargetConfigurationDetailsOutputs> = {
  component: TargetConfigurationDetailsOutputs,
  title: 'ProjectDetails/TargetConfigurationDetailsOutputs',
};

export default meta;
type Story = StoryObj<typeof TargetConfigurationDetailsOutputs>;

export const Primary: Story = {
  args: {
    outputs: ['default', 'general', 'external'],
    sourceMap: {
      'targets.target1.config1': ['source1'],
      'targets.target2': ['source2'],
    },
    targetName: 'target3',
    handleCopyClick: (text: string) => {
      console.log('Copied:', text);
    },
    taskId: 'task1',
  } as TargetConfigurationDetailsOutputsProps,
};
