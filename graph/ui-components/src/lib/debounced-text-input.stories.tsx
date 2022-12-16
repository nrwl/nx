import { ComponentMeta, ComponentStory } from '@storybook/react';
import { DebouncedTextInput } from './debounced-text-input';

const Story: ComponentMeta<typeof DebouncedTextInput> = {
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
export default Story;

const Template: ComponentStory<typeof DebouncedTextInput> = (args) => (
  <DebouncedTextInput {...args} />
);

export const Primary = Template.bind({});
Primary.args = {
  initialText: '',
  placeholderText: '',
};
