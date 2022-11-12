import { ComponentMeta, ComponentStory } from '@storybook/react';
import { TaskList, TaskListProps } from './task-list';

const Story: ComponentMeta<typeof TaskList> = {
  component: TaskList,
  title: 'TaskList',
  argTypes: {
    selectTask: {
      action: 'selectTask',
    },
  },
};
export default Story;

const Template: ComponentStory<typeof TaskList> = (args) => (
  <TaskList {...args} />
);

export const Primary = Template.bind({});
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
      },
    },
    {
      name: 'nested-app',
      type: 'app',
      data: {
        root: 'apps/nested/app',
        targets: { build: { configurations: { production: {} } } },
      },
    },
    {
      name: 'app1-e2e',
      type: 'e2e',
      data: {
        root: 'apps/app1-e2e',
        targets: { e2e: { configurations: { production: {} } } },
      },
    },
    {
      name: 'lib1',
      type: 'lib',
      data: {
        root: 'libs/lib1',
        targets: { lint: { configurations: { production: {} } } },
      },
    },
  ],

  workspaceLayout: {
    appsDir: 'apps',
    libsDir: 'libs',
  },
  selectedTask: 'app1:build:production',
};
Primary.args = args;
