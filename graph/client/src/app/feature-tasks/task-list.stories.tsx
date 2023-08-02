import type { Meta, StoryObj } from '@storybook/react';
import { TaskList, TaskListProps } from './task-list';

const meta: Meta<typeof TaskList> = {
  component: TaskList,
  title: 'TaskList',
  argTypes: {
    toggleProject: {
      action: 'selectTask',
    },
  },
};

export default meta;
type Story = StoryObj<typeof TaskList>;

const args: Partial<TaskListProps> = {
  projects: [
    {
      name: 'app1',
      type: 'app',
      data: {
        root: 'apps/app1',
        targets: {
          build: {
            configurations: { production: {}, development: {} },
            defaultConfiguration: 'production',
          },
        },
        files: [],
      },
    },
    {
      name: 'nested-app',
      type: 'app',
      data: {
        root: 'apps/nested/app',
        targets: { build: { configurations: { production: {} } } },
        files: [],
      } as any,
    },
    {
      name: 'app1-e2e',
      type: 'e2e',
      data: {
        root: 'apps/app1-e2e',
        targets: { e2e: { configurations: { production: {} } } },
        files: [],
      } as any,
    },
    {
      name: 'lib1',
      type: 'lib',
      data: {
        root: 'libs/lib1',
        targets: { lint: { configurations: { production: {} } } },
        files: [],
      } as any,
    },
  ],

  workspaceLayout: {
    appsDir: 'apps',
    libsDir: 'libs',
  },
  selectedTarget: 'build',
  errors: {
    'app1:build': 'Missing executor',
  },
};

export const Primary: Story = {
  args,
};
