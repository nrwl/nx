import type { Meta, StoryObj } from '@storybook/react';
import { JsonCodeBlock } from './json-code-block';

const meta: Meta<typeof JsonCodeBlock> = {
  component: JsonCodeBlock,
  title: 'JsonCodeBlock',
};
export default meta;

type Story = StoryObj<typeof JsonCodeBlock>;

export const Simple: Story = {
  args: {
    data: {
      commands: [{ command: 'remix build' }],
      cwd: 'apps/demo',
    },
    renderSource: (propertyName: string) => <span>test</span>,
  },
};
