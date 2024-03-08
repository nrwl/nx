import type { Meta, StoryObj } from '@storybook/react';
import {
  TaskInputsListWithSearch,
  TaskInputsListWithSearchProps,
} from './task-inputs-list-with-search';

const meta: Meta<typeof TaskInputsListWithSearch> = {
  component: TaskInputsListWithSearch,
  title: 'Tooltips/TaskInputsListWithSearch',
};

export default meta;
type Story = StoryObj<typeof TaskInputsListWithSearch>;

export const Primary: Story = {
  args: {
    inputs: {
      input1: {
        plan1: ['file1', 'file2'],
      },
      input2: {
        plan2: ['file3', 'file4'],
      },
    },
    projectName: 'project1',
    inputName: 'input1',
  } as TaskInputsListWithSearchProps,
  render: (args) => <TaskInputsListWithSearch {...args} />,
};
