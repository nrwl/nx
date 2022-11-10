import { ComponentMeta, ComponentStory } from '@storybook/react';
import { SearchDepth } from './search-depth';

export default {
  component: SearchDepth,
  title: 'Project Graph/SearchDepth',
  argTypes: {
    searchDepthFilterEnabledChange: {
      action: 'searchDepthFilterEnabledChange',
    },
    decrementDepthFilter: { action: 'decrementDepthFilter' },
    incrementDepthFilter: { action: 'incrementDepthFilter' },
  },
} as ComponentMeta<typeof SearchDepth>;

const Template: ComponentStory<typeof SearchDepth> = (args) => (
  <SearchDepth {...args} />
);

export const Primary = Template.bind({});
Primary.args = {
  searchDepthEnabled: false,
  searchDepth: 1,
};
