import type { Meta, StoryObj } from '@storybook/react';
import {
  TargetConfigurationDetailsInputs,
  TargetConfigurationDetailsInputsProps,
} from './target-configuration-details-inputs';

const meta: Meta<typeof TargetConfigurationDetailsInputs> = {
  component: TargetConfigurationDetailsInputs,
  title: 'ProjectDetails/TargetConfigurationDetailsInputs',
};

export default meta;
type Story = StoryObj<typeof TargetConfigurationDetailsInputs>;

export const Primary: Story = {
  args: {
    inputs: ['default', 'general', 'external'],
    sourceMap: {
      'targets.target1.config1': ['source1'],
      'targets.target2': ['source2'],
    },
    targetName: 'target3',
    handleCopyClick: (text: string) => {
      console.log('Copied:', text);
    },
    getInputs: (taskId: string) => {
      return Promise.resolve({
        general: {
          general1: {
            general1: ['general1'],
          },
        },
        external: {
          external1: {
            external1: ['external1'],
          },
        },
      });
    },
    taskId: 'task1',
    projectName: 'project1',
  } as TargetConfigurationDetailsInputsProps,
};
