import type { Meta, StoryObj } from '@storybook/react';
import {
  TargetConfigurationGroupList,
  TargetConfigurationGroupListProps,
} from './target-configuration-details-group-list';
import { ExpandedTargetsProvider } from '@nx/graph/shared';

const meta: Meta<typeof TargetConfigurationGroupList> = {
  component: TargetConfigurationGroupList,
  title: 'TargetConfigurationGroupList',
  decorators: [
    (story) => <ExpandedTargetsProvider>{story()}</ExpandedTargetsProvider>,
  ],
};
export default meta;

type Story = StoryObj<typeof TargetConfigurationGroupList>;

export const OneTarget: Story = {
  args: {
    project: {
      name: 'react',
      type: 'lib',
      data: {
        root: 'libs/react',
        targets: {
          build: {
            executor: 'nx',
            options: {},
            configurations: {
              production: {
                executor: 'nx',
                options: {},
              },
            },
          },
          lint: {
            executor: 'nx',
            options: {},
          },
        },
      },
    },
    sourceMap: {
      react: ['react'],
    },
    variant: 'default',
    onRunTarget: () => {},
    onViewInTaskGraph: () => {},
    selectedTargetGroup: 'build',
    setExpandTargets: () => {},
    collapseAllTargets: () => {},
  } as TargetConfigurationGroupListProps,
};

export const TwoTargets: Story = {
  args: {
    project: {
      name: 'react',
      type: 'lib',
      data: {
        root: 'libs/react',
        targets: {
          build1: {
            executor: 'nx',
            options: {},
            configurations: {
              production: {
                executor: 'nx',
                options: {},
              },
            },
          },
          build2: {
            executor: 'nx',
            options: {},
          },
        },
        metadata: {
          targetGroups: {
            build: ['build1', 'build2'],
          },
        },
      },
    },
    sourceMap: {
      react: ['react'],
    },
    variant: 'default',
    onRunTarget: () => {},
    onViewInTaskGraph: () => {},
    selectedTargetGroup: 'build',
    setExpandTargets: () => {},
    collapseAllTargets: () => {},
  } as TargetConfigurationGroupListProps,
};
