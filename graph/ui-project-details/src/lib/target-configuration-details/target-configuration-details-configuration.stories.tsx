import type { Meta, StoryObj } from '@storybook/react';
import {
  TargetConfigurationDetailsConfiguration,
  TargetConfigurationDetailsConfigurationProps,
} from './target-configuration-details-configuration';

const meta: Meta<typeof TargetConfigurationDetailsConfiguration> = {
  component: TargetConfigurationDetailsConfiguration,
  title: 'ProjectDetails/TargetConfigurationDetailsConfiguration',
};

export default meta;
type Story = StoryObj<typeof TargetConfigurationDetailsConfiguration>;

export const Primary: Story = {
  args: {
    defaultConfiguration: 'default',
    configurations: { default: { env: 'production', platform: 'linux' } },
    sourceMap: {
      'targets.default.configurations.env': ['file1', 'file2'],
      'targets.default.configurations.platform': ['file1', 'file2'],
    },
    targetName: 'default',
  } as TargetConfigurationDetailsConfigurationProps,
};
