import type { Meta, StoryObj } from '@storybook/react';
import { TagList } from './tag-list';

const meta: Meta<typeof TagList> = {
  component: TagList,
  title: 'TagList',
};
export default meta;

type Story = StoryObj<typeof TagList>;

export const FewTags: Story = {
  args: {
    tags: ['tag1', 'tag2', 'tag3'],
  },
};
export const ManyTags: Story = {
  args: {
    tags: [
      'tag1',
      'tag2',
      'tag3',
      'tag4',
      'tag5',
      'tag6',
      'tag7',
      'tag8',
      'tag9',
      'tag10',
      'tag11',
      'tag12',
      'tag13',
      'tag14',
      'tag15',
      'tag16',
      'tag17',
      'tag18',
      'tag19',
      'tag20',
    ],
  },
};
