import type { Meta, StoryObj } from '@storybook/react';
import { TargetExecutor } from './target-executor';

const meta: Meta<typeof TargetExecutor> = {
  component: TargetExecutor,
  title: 'TargetExecutor',
};
export default meta;

type Story = StoryObj<typeof TargetExecutor>;

export const Command: Story = {
  args: {
    command: 'nx run my-app:build',
  },
};

export const Commands: Story = {
  args: {
    commands: ['nx run my-app:build', 'nx run my-app:test'],
  },
};

export const Script: Story = {
  args: {
    script: 'nx run my-app:build',
  },
};

export const Executor: Story = {
  args: {
    executor: 'nx run my-app:build',
  },
};
