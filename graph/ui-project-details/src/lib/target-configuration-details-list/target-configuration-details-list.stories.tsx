import type { Meta, StoryObj } from '@storybook/react';
import {
  TargetConfigurationDetailsListComponent,
  TargetConfigurationDetailsListProps,
} from './target-configuration-details-list';
import { StoreDecorator } from '@nx/graph/state';

const meta: Meta<typeof TargetConfigurationDetailsListComponent> = {
  component: TargetConfigurationDetailsListComponent,
  title: 'TargetConfigurationDetailsListComponent',
  decorators: [StoreDecorator],
};
export default meta;

type Story = StoryObj<typeof TargetConfigurationDetailsListComponent>;

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
