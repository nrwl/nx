import type { Meta, StoryObj } from '@storybook/react';
import {
  TargetConfigurationDetailsOptions,
  TargetConfigurationDetailsOptionsProps,
} from './target-configuration-details-options';

const meta: Meta<typeof TargetConfigurationDetailsOptions> = {
  component: TargetConfigurationDetailsOptions,
  title: 'ProjectDetails/TargetConfigurationDetailsOptions',
};

export default meta;
type Story = StoryObj<typeof TargetConfigurationDetailsOptions>;

export const Primary: Story = {
  args: {
    options: {
      env: 'production',
      platform: 'linux',
    },
    sourceMap: {
      'targets.target1.config1': ['source1'],
      'targets.target2': ['source2'],
    },
    targetName: 'target3',
    handleCopyClick: (text: string) => {
      console.log('Copied:', text);
    },
  } as TargetConfigurationDetailsOptionsProps,
};
