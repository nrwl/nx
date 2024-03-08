import type { Meta, StoryObj } from '@storybook/react';
import { TaskInputsList } from './task-inputs-list';

const meta: Meta<typeof TaskInputsList> = {
  component: TaskInputsList,
  title: 'Tooltips/TaskInputsList',
};

export default meta;
type Story = StoryObj<typeof TaskInputsList>;

export const Primary: Story = {
  args: {
    projectName: 'my-lib',
    inputs: {
      input1: {
        plan1: ['file1', 'file2'],
      },
      input2: {
        plan2: ['file3', 'file4'],
      },
    },
    inputName: 'input1',
  },
  render: (args) => <TaskInputsList {...args} />,
};
