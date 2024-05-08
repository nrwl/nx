import type { Meta, StoryObj } from '@storybook/react';
import { CopyToClipboard } from './copy-to-clipboard';

const meta: Meta<typeof CopyToClipboard> = {
  component: CopyToClipboard,
  title: 'CopyToClipboard',
};
export default meta;

type Story = StoryObj<typeof CopyToClipboard>;

export const Simple: Story = {
  args: {
    onCopy: () => {},
    tooltipAlignment: 'left',
  },
};
