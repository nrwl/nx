import type { Meta, StoryObj } from '@storybook/react';
import {
  TaskInputsListAccordions,
  TaskInputsListAccordionProps,
} from './task-inputs-accordions';

const meta: Meta<typeof TaskInputsListAccordions> = {
  component: TaskInputsListAccordions,
  title: 'Tooltips/TaskInputsListAccordions',
};

export default meta;
type Story = StoryObj<typeof TaskInputsListAccordions>;

export const Primary: Story = {
  args: {
    projectName: 'my-lib',
    inputs: {
      input1: {
        general: {
          plan1: ['file1', 'file2'],
        },
      },
      input2: {
        general: {
          plan2: ['file3', 'file4'],
        },
      },
    },
    inputNmame: 'input1',
  } as TaskInputsListAccordionProps,
  render: (args: TaskInputsListAccordionProps) => (
    <TaskInputsListAccordions {...args} />
  ),
};
