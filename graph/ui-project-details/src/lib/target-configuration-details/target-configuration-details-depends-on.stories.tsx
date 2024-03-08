import type { Meta, StoryObj } from '@storybook/react';
import {
  TargetConfigurationDetailsDependsOn,
  TargetConfigurationDetailsDependsOnProps,
} from './target-configuration-details-depends-on';

const meta: Meta<typeof TargetConfigurationDetailsDependsOn> = {
  component: TargetConfigurationDetailsDependsOn,
  title: 'ProjectDetails/TargetConfigurationDetailsDependsOn',
};

export default meta;
type Story = StoryObj<typeof TargetConfigurationDetailsDependsOn>;

export const Primary: Story = {
  args: {
    dependsOn: [
      {
        target: 'target1',
        config: 'config1',
      },
      'target2',
    ],
    sourceMap: {
      'targets.target1.config1': ['source1'],
      'targets.target2': ['source2'],
    },
    targetName: 'target3',
    handleCopyClick: (text: string) => {
      console.log('Copied:', text);
    },
  } as TargetConfigurationDetailsDependsOnProps,
};
