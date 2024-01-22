import type { Meta, StoryObj } from '@storybook/react';
import { SearchDepth } from './search-depth';

const meta: Meta<typeof SearchDepth> = {
  component: SearchDepth,
  title: 'Project Graph/SearchDepth',
  argTypes: {
    searchDepthFilterEnabledChange: {
      action: 'searchDepthFilterEnabledChange',
    },
    decrementDepthFilter: { action: 'decrementDepthFilter' },
    incrementDepthFilter: { action: 'incrementDepthFilter' },
  },
};

export default meta;
type Story = StoryObj<typeof SearchDepth>;

export const Primary: Story = {
  args: {
    searchDepthEnabled: false,
    searchDepth: 1,
  },
};
