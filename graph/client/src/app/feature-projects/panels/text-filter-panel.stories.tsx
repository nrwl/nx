import { ComponentMeta, ComponentStory } from '@storybook/react';
import { TextFilterPanel } from './text-filter-panel';

export default {
  component: TextFilterPanel,
  title: 'Project Graph/TextFilterPanel',
  argTypes: {
    resetTextFilter: { action: 'resetTextFilter' },
    toggleIncludeLibsInPathChange: {
      action: 'toggleIncludeLibsInPathChange',
    },
    updateTextFilter: {
      action: 'updateTextFilter',
    },
  },
} as ComponentMeta<typeof TextFilterPanel>;

const Template: ComponentStory<typeof TextFilterPanel> = (args) => (
  <TextFilterPanel {...args} />
);

export const Primary = Template.bind({});
Primary.args = {
  includePath: false,
  textFilter: 'some-lib',
};
