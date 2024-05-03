import type { Meta, StoryObj } from '@storybook/react';
import {
  TargetConfigurationDetailsList,
  TargetConfigurationDetailsListProps,
} from './target-configuration-details-list';

const meta: Meta<typeof TargetConfigurationDetailsList> = {
  component: TargetConfigurationDetailsList,
  title: 'TargetConfigurationDetailsList',
};
export default meta;

type Story = StoryObj<typeof TargetConfigurationDetailsList>;

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
  } as TargetConfigurationDetailsListProps,
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
  } as TargetConfigurationDetailsListProps,
};
