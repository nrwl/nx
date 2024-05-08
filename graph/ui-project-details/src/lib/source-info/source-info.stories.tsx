import type { Meta, StoryObj } from '@storybook/react';
import { SourceInfo } from './source-info';

const meta: Meta<typeof SourceInfo> = {
  component: SourceInfo,
  title: 'SourceInfo',
};
export default meta;

type Story = StoryObj<typeof SourceInfo>;

export const Simple: Story = {
  args: {
    data: ['data1', 'data2'],
    propertyKey: 'test',
  },
};
