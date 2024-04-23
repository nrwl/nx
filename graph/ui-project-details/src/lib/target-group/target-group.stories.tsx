import type { Meta, StoryObj } from '@storybook/react';
import { TargetGroup, TargetGroupProps } from './target-group';

const meta: Meta<typeof TargetGroup> = {
  component: TargetGroup,
  title: 'TargetGroup',
};
export default meta;

type Story = StoryObj<typeof TargetGroup>;

export const Simple: Story = {
  args: {
    name: 'react',
    selected: false,
    isCompact: false,
    onClick: () => {},
  },
};

export const Compact: Story = {
  args: {
    name: 'react',
    selected: false,
    isCompact: true,
    onClick: () => {},
  } as TargetGroupProps,
};
