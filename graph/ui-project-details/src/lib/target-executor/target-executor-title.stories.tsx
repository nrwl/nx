import type { Meta, StoryObj } from '@storybook/react';
import { TargetExecutorTitle } from './target-executor-title';

const meta: Meta<typeof TargetExecutorTitle> = {
  component: TargetExecutorTitle,
  title: 'TargetExecutorTitle',
};
export default meta;

type Story = StoryObj<typeof TargetExecutorTitle>;

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
  args: {},
};
