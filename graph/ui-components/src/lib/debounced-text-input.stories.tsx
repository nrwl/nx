import type { Meta, StoryObj } from '@storybook/react';
import { DebouncedTextInput } from './debounced-text-input';

const meta: Meta<typeof DebouncedTextInput> = {
  component: DebouncedTextInput,
  title: 'Shared/DebouncedTextInput',
  argTypes: {
    resetTextFilter: {
      action: 'resetTextFilter',
    },
    updateTextFilter: {
      action: 'updateTextFilter',
    },
  },
};

export default meta;
type Story = StoryObj<typeof DebouncedTextInput>;

export const Primary: Story = {
  args: {
    initialText: '',
    placeholderText: '',
  },
};
